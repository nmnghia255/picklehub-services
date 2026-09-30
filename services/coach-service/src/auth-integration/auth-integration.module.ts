import { Module, Global } from '@nestjs/common';
import { AuthIntegrationService } from './auth-integration.service';

@Global()
@Module({
  providers: [AuthIntegrationService],
  exports: [AuthIntegrationService],
})
export class AuthIntegrationModule {}
