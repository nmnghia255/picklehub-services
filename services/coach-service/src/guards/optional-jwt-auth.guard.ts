import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch (error) {
      // Ignore UnauthorizedException. If the token is missing or invalid,
      // we still allow the request to proceed, just without `req.user`.
    }
    return true; // Always allow access
  }
}
