import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  sub: string;
  userId?: string;
  email?: string;
  role?: string | string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthProxyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization as string | undefined;

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authorization.substring(7); // "Bearer ".length is 7

    try {
      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) {
        throw new Error('JWT_ACCESS_SECRET is not configured');
      }

      const payload = jwt.verify(token, secret) as JwtPayload;
      const userId = payload.sub || payload.userId;

      if (!userId) {
        throw new UnauthorizedException('Unable to identify current user');
      }

      request.user = {
        sub: userId,
        userId: userId,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch (err) {
      console.error('JWT verification error:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

