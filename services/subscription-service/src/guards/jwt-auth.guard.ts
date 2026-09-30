import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  userId?: string;
  email?: string;
  role?: string | string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const payload = this.verifyJwt(token);
    const userId = payload.sub || payload.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    request.user = {
      userId,
      email: payload.email,
      roles: Array.isArray(payload.role)
        ? payload.role
        : payload.role
          ? [payload.role]
          : [],
    };

    return true;
  }

  private verifyJwt(token: string): JwtPayload {
    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!secret) throw new Error('JWT secret is not configured');
      return jwt.verify(token, secret) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      return null;
    }
    const [, token] = authHeader.split(' ');
    return token ?? null;
  }
}
