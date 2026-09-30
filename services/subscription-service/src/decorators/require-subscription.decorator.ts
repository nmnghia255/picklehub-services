import { SetMetadata } from '@nestjs/common';
import { PlanType } from '@prisma/client';

export const PLAN_TYPE_KEY = 'requiredPlanType';

/**
 * Decorator to specify which PlanType subscription is needed to access a route.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, SubscriptionGuard)
 *   @RequireSubscription(PlanType.GROUP_OWNER)
 *   @Post()
 *   createGroup() { ... }
 */
export const RequireSubscription = (planType: PlanType) =>
  SetMetadata(PLAN_TYPE_KEY, planType);
