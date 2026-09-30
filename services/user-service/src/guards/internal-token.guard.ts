import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers?.['x-internal-service-token'] as string | undefined;
    const expected = process.env.SERVICE_INTERNAL_TOKEN ?? '';

    if (!expected) {
      throw new UnauthorizedException('Internal token not configured.');
    }

    if (!token || token !== expected) {
      throw new UnauthorizedException('Missing or invalid internal service token.');
    }

    return true;
  }
}
