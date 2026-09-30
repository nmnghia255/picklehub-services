import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  Request,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListMySubscriptionsQueryDto } from './dto/list-my-subscriptions.query.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

type AuthRequest = Request & {
  user?: { userId: string; email?: string; roles?: string[] };
};

@ApiTags('Subscriptions')
@Controller('api/subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ──────────────────────────────────────────────────────────────────
  //  POST /api/subscriptions  — initiate a new subscription purchase
  // ──────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Initiate a subscription purchase',
    description:
      'Creates a `PENDING_PAYMENT` subscription record and returns a **VNPay payment URL**. ' +
      'Redirect the user to `paymentUrl` to complete payment. ' +
      'The subscription only becomes `ACTIVE` after VNPay confirms payment via the IPN webhook.',
  })
  @ApiQuery({
    name: 'returnUrl',
    required: false,
    example: 'https://app.picklehub.vn/payment/result',
    description:
      'Frontend URL that VNPay will redirect the user to after payment. ' +
      'Defaults to `FRONTEND_URL` env var if not provided.',
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription initiated. Redirect the user to `paymentUrl`.',
    schema: {
      example: {
        subscriptionId: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
        plan: {
          id: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
          name: 'Gói Quản lý Hội nhóm - Tháng',
          type: 'GROUP_OWNER',
          billingCycle: 'MONTHLY',
          priceVnd: 99000,
          durationInDays: 30,
        },
        paymentUrl:
          'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=9900000&vnp_Command=pay&vnp_CreateDate=20260610153000&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=PickleHub+-+G%C3%B3i+Qu%E1%BA%A3n+l%C3%BD+H%E1%BB%99i+nh%C3%B3m+-+Th%C3%A1ng&vnp_OrderType=other&vnp_ReturnUrl=https%3A%2F%2Fapp.picklehub.vn%2Fpayment%2Fresult&vnp_TmnCode=PICKLEHUB&vnp_TxnRef=SUB-A3F1C2E48B9D&vnp_Version=2.1.0&vnp_SecureHash=abc123...',
        txnRef: 'SUB-A3F1C2E48B9D',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid Bearer token.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Missing or invalid Authorization header',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Plan not found or inactive.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Plan 7e4f1a2b-xxxx not found or not active',
        error: 'Not Found',
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @Request() req: AuthRequest,
    @Body() dto: CreateSubscriptionDto,
    @Query('returnUrl') returnUrl: string,
    @Ip() ip: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');

    const finalReturnUrl =
      returnUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

    return this.subscriptionService.initiate(userId, dto, ip, finalReturnUrl);
  }

  // ──────────────────────────────────────────────────────────────────
  //  GET /api/subscriptions/me  — list my subscriptions
  // ──────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({
    summary: 'List my subscriptions',
    description:
      'Returns all subscriptions belonging to the authenticated user. ' +
      '**A user can hold multiple active subscriptions simultaneously** — one per plan type ' +
      '(e.g., `GROUP_OWNER` + `SOCIAL_HOST` at the same time). ' +
      'Use the optional `status` query param to filter.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of user subscriptions (most recent first).',
    schema: {
      example: [
        {
          id: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
          userId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
          planId: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
          status: 'ACTIVE',
          startDate: '2026-06-10T15:30:00.000Z',
          endDate: '2026-07-10T15:30:00.000Z',
          autoRenew: false,
          createdAt: '2026-06-10T15:29:55.000Z',
          updatedAt: '2026-06-10T15:30:01.000Z',
          plan: {
            id: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
            type: 'GROUP_OWNER',
            billingCycle: 'MONTHLY',
            name: 'Gói Quản lý Hội nhóm - Tháng',
            description: 'Dành cho người dẫn đầu cộng đồng pickleball.',
            features: [
              'Tạo hội nhóm không giới hạn',
              'Quản lý thành viên & phân quyền',
              'Theo dõi quỹ nhóm & chi tiêu',
            ],
            priceVnd: 99000,
            durationInDays: 30,
            isActive: true,
            sortOrder: 20,
          },
        },
        {
          id: 'b9c4d7e1-2f3a-4b5c-8d9e-0f1a2b3c4d5e',
          userId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
          planId: 'c2d5e8f1-4a6b-7c8d-9e0f-1a2b3c4d5e6f',
          status: 'ACTIVE',
          startDate: '2026-06-01T09:00:00.000Z',
          endDate: '2026-07-01T09:00:00.000Z',
          autoRenew: false,
          createdAt: '2026-06-01T08:59:50.000Z',
          updatedAt: '2026-06-01T09:00:02.000Z',
          plan: {
            id: 'c2d5e8f1-4a6b-7c8d-9e0f-1a2b3c4d5e6f',
            type: 'SOCIAL_HOST',
            billingCycle: 'MONTHLY',
            name: 'Gói Tổ chức Giao lưu - Tháng',
            description: 'Dành cho người tổ chức buổi chơi giao lưu xã hội.',
            features: [
              'Tạo buổi chơi giao lưu (Social Play)',
              'Ghép đôi tự động thông minh',
            ],
            priceVnd: 149000,
            durationInDays: 30,
            isActive: true,
            sortOrder: 30,
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Missing or invalid Authorization header',
        error: 'Unauthorized',
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  findMine(
    @Request() req: AuthRequest,
    @Query() query: ListMySubscriptionsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.subscriptionService.findMySubscriptions(userId, query);
  }

  // ──────────────────────────────────────────────────────────────────
  //  GET /api/subscriptions/:id  — get one subscription detail
  // ──────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get subscription detail (with payment history)',
    description:
      'Returns a single subscription with its full plan and all associated payment records. ' +
      'Only the owning user can access their own subscription.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription UUID.',
    example: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription detail including plan and payment history.',
    schema: {
      example: {
        id: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
        userId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
        planId: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
        status: 'ACTIVE',
        startDate: '2026-06-10T15:30:00.000Z',
        endDate: '2026-07-10T15:30:00.000Z',
        autoRenew: false,
        createdAt: '2026-06-10T15:29:55.000Z',
        updatedAt: '2026-06-10T15:30:01.000Z',
        plan: {
          id: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
          type: 'GROUP_OWNER',
          billingCycle: 'MONTHLY',
          name: 'Gói Quản lý Hội nhóm - Tháng',
          priceVnd: 99000,
          durationInDays: 30,
        },
        payments: [
          {
            id: 'd1e2f3a4-5b6c-7d8e-9f0a-1b2c3d4e5f6a',
            subscriptionId: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
            userId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
            amountVnd: 99000,
            status: 'SUCCESS',
            vnpTxnRef: 'SUB-A3F1C2E48B9D',
            vnpTransactionNo: '14523156',
            vnpBankCode: 'NCB',
            vnpPayDate: '20260610153000',
            vnpResponseCode: '00',
            paidAt: '2026-06-10T15:30:00.000Z',
            createdAt: '2026-06-10T15:29:55.000Z',
            updatedAt: '2026-06-10T15:30:01.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Missing or invalid Authorization header',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found or does not belong to caller.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Subscription a3f1c2e4-xxxx not found',
        error: 'Not Found',
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.subscriptionService.findOneSubscription(userId, id);
  }

  // ──────────────────────────────────────────────────────────────────
  //  PATCH /api/subscriptions/:id/cancel  — cancel active subscription
  // ──────────────────────────────────────────────────────────────────

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an active subscription',
    description:
      'Immediately sets the subscription status to `CANCELLED`. ' +
      'The user will lose access to the plan features as soon as cancellation is confirmed. ' +
      'Refund logic is handled separately and is not part of this endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription UUID.',
    example: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription successfully cancelled.',
    schema: {
      example: {
        id: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
        userId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
        planId: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
        status: 'CANCELLED',
        startDate: '2026-06-10T15:30:00.000Z',
        endDate: '2026-07-10T15:30:00.000Z',
        autoRenew: false,
        createdAt: '2026-06-10T15:29:55.000Z',
        updatedAt: '2026-06-10T16:45:00.000Z',
        plan: {
          id: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
          type: 'GROUP_OWNER',
          billingCycle: 'MONTHLY',
          name: 'Gói Quản lý Hội nhóm - Tháng',
          priceVnd: 99000,
          durationInDays: 30,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel — subscription is not in ACTIVE state.',
    schema: {
      example: {
        statusCode: 400,
        message: 'Only ACTIVE subscriptions can be cancelled',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Missing or invalid Authorization header',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found or does not belong to caller.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Subscription a3f1c2e4-xxxx not found',
        error: 'Not Found',
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  cancel(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.subscriptionService.cancel(userId, id);
  }
}
