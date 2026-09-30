import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

export const REQUIRED_SUBSCRIPTION_KEY = 'requiredSubscriptionPlanType';
export const RequireSubscription = (planType: string) =>
  SetMetadata(REQUIRED_SUBSCRIPTION_KEY, planType);

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlanType = this.reflector.getAllAndOverride<string>(
      REQUIRED_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPlanType) return true;

    const request = context.switchToHttp().getRequest();
    const callerId = request.user?.userId ?? request.user?.sub ?? this.extractUserIdFromBearerToken(request);
    if (!callerId) throw new UnauthorizedException('User not authenticated');

    const subscriptionServiceUrl =
      process.env.SUBSCRIPTION_SERVICE_URL ??
      'http://subscription-service:8012';
    const subscriptionInternalToken =
      process.env.SERVICE_INTERNAL_TOKEN ?? '';

    try {
      const response = await axios.get(
        `${subscriptionServiceUrl}/internal/subscriptions/verify`,
        {
          params: { userId: callerId, planType: requiredPlanType },
          headers: { 'x-internal-token': subscriptionInternalToken },
          validateStatus: () => true,
        },
      );

      if (response.status !== 200 || !response.data?.hasAccess) {
        throw new ForbiddenException(
          `Active ${requiredPlanType} subscription required to perform this action`,
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ForbiddenException('Failed to verify subscription. Please try again later.');
    }

    return true;
  }

  private extractUserIdFromBearerToken(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    const [, token] = authHeader.split(' ');
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!token || !secret) return undefined;

    try {
      const payload = jwt.verify(token, secret) as { sub?: string; userId?: string };
      return payload.sub ?? payload.userId;
    } catch {
      return undefined;
    }
  }
}
