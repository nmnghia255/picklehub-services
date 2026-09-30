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
  constructor(private readonly configService: ConfigService) { }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Bypass OPTIONS requests
    if (request.method === 'OPTIONS') {
      return true;
    }

    // 2. Bypass health check and Swagger docs
    const url = request.url;
    if (url === '/health' || url.includes('/api-docs')) {
      return true;
    }

    // 3. Bypass internal requests
    const internalToken = process.env.SERVICE_INTERNAL_TOKEN;
    if (internalToken && request.headers?.['x-internal-token'] === internalToken) {
      return true;
    }

    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const payload = this.verifyJwt(token);

    const userId = this.extractUserId(payload);
    const roles = this.extractRoles(payload);

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    request.user = {
      userId,
      email: payload.email,
      roles
    };

    return true;
  }

  // Helper to verify JWT and extract payload
  private verifyJwt(token: string): JwtPayload {
    try {
      // Prefer access-token secret; keep legacy fallback for compatibility
      const secret =
        this.configService.get<string>('JWT_ACCESS_SECRET');

      if (!secret) {
        throw new Error('JWT secret is not configured');
      }

      // verify token and return payload
      return jwt.verify(token, secret) as JwtPayload;
    } catch (err) {
      console.error('JWT verification error:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Helper to extract Bearer token from Authorization header
  private extractBearerToken(request: any): string | null {
    // Get token from header
    const authHeader = request.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return null;
    }

    const [type, token] = parts;
    if (type?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }

  // Helper to extract user ID from JWT payload
  private extractUserId(payload: JwtPayload): string | undefined {
    // Support both 'sub' and 'userId' claims for user ID
    return payload.sub || payload.userId;
  }

  // Helper to normalize roles from JWT payload
  private extractRoles(payload: JwtPayload): string[] {
    if (!payload.role) return [];
    return Array.isArray(payload.role) ? payload.role : [payload.role];
  }
}
