import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expectedToken = process.env.SERVICE_INTERNAL_TOKEN;
    const providedToken = request.headers?.['x-internal-token'];

    if (!expectedToken) {
      throw new ForbiddenException('SERVICE_INTERNAL_TOKEN is not configured');
    }

    if (providedToken !== expectedToken) {
      throw new ForbiddenException('Invalid internal token');
    }

    return true;
  }
}
