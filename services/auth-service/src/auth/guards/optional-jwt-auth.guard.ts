import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT guard — attaches `req.user` when a valid Bearer token is
 * present, but does NOT throw when the token is absent or invalid.
 * Use on endpoints that support both authenticated and anonymous access.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Override so Passport never rejects the request — just return null user
  handleRequest(_err: any, user: any) {
    return user ?? null;
  }
}
