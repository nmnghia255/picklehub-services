import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AuthProxyGuard implements CanActivate {
  private get authServiceUrl() {
    return process.env.AUTH_SERVICE_URL ?? 'http://localhost:8001';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization as string | undefined;

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const response = await axios.get(`${this.authServiceUrl}/api/auth/me`, {
      headers: { Authorization: authorization },
      validateStatus: () => true,
    });

    if (response.status !== 200 || !response.data?.id) {
      throw new UnauthorizedException('Invalid access token');
    }

    request.user = {
      sub: response.data.id,
      email: response.data.email,
      name: response.data.name,
      role: response.data.role,
    };

    return true;
  }
}
