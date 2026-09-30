import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guards internal endpoints that should only be called from other services.
 * Validates the `x-internal-token` header against SERVICE_INTERNAL_TOKEN env var.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-internal-token'];
    const expected = process.env.SERVICE_INTERNAL_TOKEN;

    if (!expected) throw new ForbiddenException('Internal token not configured');
    if (token !== expected) throw new ForbiddenException('Invalid internal token');

    return true;
  }
}
