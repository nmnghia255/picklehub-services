import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard to protect internal service endpoints
 * Validates API token via custom header for service-to-service communication
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
    constructor(private configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const serviceToken = request.headers['x-internal-service-token'];

        if (!serviceToken) {
            throw new UnauthorizedException('Missing X-Internal-Service-Token header');
        }

        const validToken = this.configService.get<string>(
            'SERVICE_INTERNAL_TOKEN',
        );

        if (serviceToken !== validToken) {
            throw new UnauthorizedException('Invalid service token');
        }

        return true;
    }
}
