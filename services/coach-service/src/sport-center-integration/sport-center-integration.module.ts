import { Module, Global } from '@nestjs/common';
import { SportCenterIntegrationService } from './sport-center-integration.service';

@Global()
@Module({
  providers: [SportCenterIntegrationService],
  exports: [SportCenterIntegrationService],
})
export class SportCenterIntegrationModule {}
