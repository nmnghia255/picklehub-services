import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';

interface AuthMeResponse {
  id: string;
  email?: string;
  name?: string | null;
  avatarUrl?: string | null;
}

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    id: string;
    email?: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

function isAuthMeResponse(data: unknown): data is AuthMeResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const maybeData = data as Record<string, unknown>;
  return typeof maybeData.id === 'string';
}

@Injectable()
export class AuthProxyGuard implements CanActivate {
  private get authServiceUrl(): string {
    return process.env.AUTH_SERVICE_URL ?? 'http://localhost:8001';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !authorization.toLowerCase().startsWith('bearer ')
    ) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    try {
      const response = await axios.get<AuthMeResponse>(
        `${this.authServiceUrl}/api/auth/me`,
        {
          headers: { Authorization: authorization },
          validateStatus: () => true,
        },
      );

      if (response.status !== 200 || !isAuthMeResponse(response.data)) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        avatarUrl: response.data.avatarUrl,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
