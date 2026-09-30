import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const roles = request.user.roles ??
      (request.user.role
        ? Array.isArray(request.user.role)
          ? request.user.role
          : [request.user.role]
        : []);

    if (!roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}