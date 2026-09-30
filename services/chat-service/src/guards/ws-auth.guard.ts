import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import axios from 'axios';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private get authServiceUrl() {
    return process.env.AUTH_SERVICE_URL ?? 'http://localhost:8001';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const authHeader = this.getAuthorizationHeader(client);

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new WsException('Unauthorized: Missing or invalid token');
    }

    const response = await axios.get(`${this.authServiceUrl}/api/auth/me`, {
      headers: { Authorization: authHeader },
      validateStatus: () => true,
    });

    if (response.status === 200 && response.data?.id) {
      (client as any).user = {
        sub: response.data.id,
        email: response.data.email,
        name: response.data.name,
        role: response.data.role,
      };
      return true;
    }

    throw new WsException('Unauthorized: Invalid access token');
  }

  private getAuthorizationHeader(client: Socket): string | undefined {
    const header = client.handshake.headers?.authorization;
    if (header) return header;

    const token = client.handshake.auth?.token;
    if (!token) return undefined;

    return token.toLowerCase().startsWith('bearer ')
      ? token
      : `Bearer ${token}`;
  }
}
