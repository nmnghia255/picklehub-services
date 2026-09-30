import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

export const REQUIRED_SUBSCRIPTION_KEY = 'requiredSubscriptionPlanType';
export const RequireSubscription = (planType: string) =>
  SetMetadata(REQUIRED_SUBSCRIPTION_KEY, planType);

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlanType = this.reflector.getAllAndOverride<string>(
      REQUIRED_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPlanType) return true;

    const request = context.switchToHttp().getRequest();
    const callerId = request.user?.userId ?? this.extractUserIdFromBearerToken(request);
    if (!callerId) throw new UnauthorizedException('User not authenticated');

    const subscriptionServiceUrl =
      this.configService.get<string>('SUBSCRIPTION_SERVICE_URL') ??
      'http://subscription-service:8012';
    const subscriptionInternalToken =
      this.configService.get<string>('SERVICE_INTERNAL_TOKEN') ?? '';

    try {
      const url = new URL('/internal/subscriptions/verify', subscriptionServiceUrl);
      url.searchParams.set('userId', callerId);
      url.searchParams.set('planType', requiredPlanType);

      const response = await fetch(url, {
        headers: { 'x-internal-token': subscriptionInternalToken },
      });
      const data = await response.json().catch(() => null);

      if (response.status !== 200 || !data?.hasAccess) {
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
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!token || !secret) return undefined;

    try {
      const payload = jwt.verify(token, secret) as { sub?: string; userId?: string };
      return payload.sub ?? payload.userId;
    } catch {
      return undefined;
    }
  }
}
