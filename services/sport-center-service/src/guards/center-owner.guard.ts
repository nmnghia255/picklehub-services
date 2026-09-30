import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";

/**
 * Authorizes the request only if the JWT user is the owner of the sport center
 * resolved from the `:centerId` route param. Stack AFTER `JwtAuthGuard` so
 * `req.user.userId` is already populated.
 */
@Injectable()
export class CenterOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    const centerId: string | undefined = request.params?.centerId;

    if (!userId) {
      throw new ForbiddenException("Unable to identify current user");
    }
    if (!centerId) {
      throw new ForbiddenException("Sport center id is missing from the route");
    }

    const center = await this.prisma.sportCenter.findUnique({
      where: { id: centerId },
      select: { ownerId: true },
    });

    if (!center) {
      throw new NotFoundException("Sport center not found");
    }
    if (center.ownerId !== userId) {
      throw new ForbiddenException("Not the owner of this sport center");
    }

    return true;
  }
}
