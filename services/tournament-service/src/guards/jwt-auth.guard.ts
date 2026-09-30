import { Injectable } from '@nestjs/common';
import { AuthProxyGuard } from './auth-proxy.guard';

@Injectable()
export class JwtAuthGuard extends AuthProxyGuard {}

