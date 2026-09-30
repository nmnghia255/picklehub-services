import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GroupArchiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    // Bypass internal requests
    const internalToken = process.env.SERVICE_INTERNAL_TOKEN;
    if (internalToken && request.headers?.['x-internal-token'] === internalToken) {
      return true;
    }

    // Only block modifying actions: POST, PUT, DELETE, PATCH
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      // Bypass restore endpoint
      if (url.includes('/restore')) {
        return true;
      }

      // Try to find groupId or id from parameters
      const groupId = request.params.groupId || request.params.id;

      if (groupId) {
        const group = await this.prisma.group.findUnique({
          where: { id: groupId },
        });

        if (!group) {
          throw new NotFoundException('Group not found');
        }

        if (group.status === 'ARCHIVED') {
          throw new ForbiddenException(
            'Action forbidden: This group has been archived',
          );
        }
      }
    }

    return true;
  }
}
