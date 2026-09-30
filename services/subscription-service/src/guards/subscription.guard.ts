import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_TYPE_KEY } from '../decorators/require-subscription.decorator';
import { PrismaService } from '../prisma.service';
import { SubscriptionStatus } from '@prisma/client';

/**
 * SubscriptionGuard — use alongside @RequireSubscription(PlanType.XXX) on a controller method.
 *
 * It checks the DB directly (since it is already inside subscription-service).
 * In OTHER services, you would instead call this service's /internal/subscriptions/verify endpoint.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredType = this.reflector.getAllAndOverride<string>(
      PLAN_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @RequireSubscription decorator, skip the check
    if (!requiredType) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;

    if (!userId) throw new ForbiddenException('User not authenticated');

    const now = new Date();
    const active = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: now },
        plan: { type: requiredType as any },
      },
    });

    if (!active) {
      throw new ForbiddenException(
        `An active ${requiredType} subscription is required to perform this action.`,
      );
    }

    return true;
  }
}
