import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * AdminRoleGuard — must be used AFTER JwtAuthGuard.
 * Throws 403 if the authenticated user does not have the 'ADMIN' role.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { userId: string; roles?: string[] };
    }>();

    const roles = request.user?.roles ?? [];

    if (!roles.includes('ADMIN')) {
      throw new ForbiddenException(
        'Access denied. This endpoint requires the ADMIN role.',
      );
    }

    return true;
  }
}
