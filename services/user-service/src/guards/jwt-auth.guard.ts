import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthProxyGuard } from './auth-proxy.guard';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authProxyGuard: AuthProxyGuard) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    return this.authProxyGuard.canActivate(context);
  }
}
