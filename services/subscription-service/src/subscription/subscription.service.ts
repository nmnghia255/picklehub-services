import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListMySubscriptionsQueryDto } from './dto/list-my-subscriptions.query.dto';
import { VnpayHelper, VnpayIpnParams } from './vnpay.helper';
import { SubscriptionStatus, PaymentStatus, PlanType } from '@prisma/client';


@Injectable()
export class SubscriptionService {
  private readonly vnpay = new VnpayHelper();

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────
  //  Public: Plan catalog
  // ──────────────────────────────────────────────────────────────────

  /** Initiate a subscription purchase → returns VNPay payment URL. */
  async initiate(
    userId: string,
    dto: CreateSubscriptionDto,
    clientIp: string,
    returnUrl: string,
  ) {
    // 1. Validate plan exists and is active
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Plan ${dto.planId} not found or not active`);
    }

    // 2. Create a PENDING_PAYMENT subscription record
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.PENDING_PAYMENT,
        autoRenew: dto.autoRenew ?? false,
      },
      include: { plan: true },
    });

    // 3. Generate a unique VNPay transaction reference
    const txnRef = `SUB-${subscription.id.replace(/-/g, '').substring(0, 12).toUpperCase()}`;

    // 4. Create the payment record
    await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        amountVnd: plan.priceVnd,
        status: PaymentStatus.PENDING,
        vnpTxnRef: txnRef,
      },
    });

    // 5. Build the VNPay payment URL
    const paymentUrl = this.vnpay.createPaymentUrl({
      txnRef,
      amount: plan.priceVnd,
      orderInfo: `PickleHub - ${plan.name}`,
      returnUrl,
      ipAddr: clientIp,
    });

    return {
      subscriptionId: subscription.id,
      plan: {
        id: plan.id,
        name: plan.name,
        type: plan.type,
        billingCycle: plan.billingCycle,
        priceVnd: plan.priceVnd,
        durationInDays: plan.durationInDays,
      },
      paymentUrl,
      txnRef,
    };
  }

  // ──────────────────────────────────────────────────────────────────
  //  VNPay IPN handler (called by VNPay server-to-server)
  // ──────────────────────────────────────────────────────────────────

  async handleVnpayIpn(params: VnpayIpnParams) {
    // 1. Verify signature
    if (!this.vnpay.verifyIpnSignature(params)) {
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    // 2. Find the payment by txnRef
    const payment = await this.prisma.payment.findUnique({
      where: { vnpTxnRef: params.vnp_TxnRef },
      include: { subscription: { include: { plan: true } } },
    });

    if (!payment) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // 3. Prevent double-processing
    if (payment.status !== PaymentStatus.PENDING) {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    // 4. Verify amount matches
    const expectedAmount = payment.amountVnd * 100; // VNPay sends amount * 100
    if (Number(params.vnp_Amount) !== expectedAmount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    const isSuccess = params.vnp_ResponseCode === '00';
    const now = new Date();

    if (isSuccess) {
      const plan = payment.subscription.plan;
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + plan.durationInDays);

      // 5a. Activate subscription and record payment details atomically
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS,
            vnpTransactionNo: params.vnp_TransactionNo,
            vnpBankCode: params.vnp_BankCode,
            vnpPayDate: params.vnp_PayDate,
            vnpResponseCode: params.vnp_ResponseCode,
            paidAt: now,
          },
        }),
        this.prisma.subscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            startDate: now,
            endDate,
          },
        }),
      ]);
    } else {
      // 5b. Mark as failed
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            vnpResponseCode: params.vnp_ResponseCode,
          },
        }),
        this.prisma.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: SubscriptionStatus.CANCELLED },
        }),
      ]);
    }

    return { RspCode: '00', Message: 'Confirm success' };
  }

  // ──────────────────────────────────────────────────────────────────
  //  User subscription queries
  // ──────────────────────────────────────────────────────────────────

  async findMySubscriptions(userId: string, query: ListMySubscriptionsQueryDto) {
    return this.prisma.subscription.findMany({
      where: {
        userId,
        ...(query.status && { status: query.status }),
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneSubscription(userId: string, subscriptionId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
      include: { plan: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!sub) throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    return sub;
  }

  async cancel(userId: string, subscriptionId: string) {
    const sub = await this.findOneSubscription(userId, subscriptionId);

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE subscriptions can be cancelled');
    }

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED },
      include: { plan: true },
    });
  }

  // ──────────────────────────────────────────────────────────────────
  //  Internal: used by SubscriptionGuard in OTHER services via HTTP
  // ──────────────────────────────────────────────────────────────────

  async verify(userId: string, planType: PlanType) {
    const now = new Date();
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: now },
        plan: { type: planType },
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });

    return {
      hasAccess: !!sub,
      planType,
      subscriptionId: sub?.id ?? null,
      expiresAt: sub?.endDate ?? null,
    };
  }
}
