import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import axios from 'axios';

@Injectable()
export class GroupOwnerSubscriptionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Bypass internal requests
    const internalToken =
      this.configService.get<string>('SERVICE_INTERNAL_TOKEN') ||
      process.env.SERVICE_INTERNAL_TOKEN;
    if (internalToken && request.headers?.['x-internal-token'] === internalToken) {
      return true;
    }

    // Only check for modifying actions: POST, PUT, DELETE, PATCH
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const groupId = request.params.groupId || request.params.id;

      if (groupId) {
        const group = await this.prisma.group.findUnique({
          where: { id: groupId },
        });

        if (!group) {
          throw new NotFoundException('Group not found');
        }

        const ownerId = group.createdById;
        const subscriptionServiceUrl =
          this.configService.get<string>('SUBSCRIPTION_SERVICE_URL') ??
          'http://subscription-service:8012';
        const subscriptionInternalToken = internalToken ?? '';

        try {
          const response = await axios.get(
            `${subscriptionServiceUrl}/internal/subscriptions/verify`,
            {
              params: {
                userId: ownerId,
                planType: 'GROUP_OWNER',
              },
              headers: {
                'x-internal-token': subscriptionInternalToken,
              },
              validateStatus: () => true,
            },
          );

          if (response.status !== 200 || !response.data?.hasAccess) {
            throw new ForbiddenException(
              'Active GROUP_OWNER subscription required for the group owner to perform this action',
            );
          }
        } catch (error) {
          if (error instanceof ForbiddenException) {
            throw error;
          }
          throw new ForbiddenException(
            'Failed to verify group owner subscription. Please try again later.',
          );
        }
      }
    }

    return true;
  }
}
