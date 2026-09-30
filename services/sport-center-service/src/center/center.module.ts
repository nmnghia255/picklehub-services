import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { CenterController } from './center.controller';
import { CenterService } from './center.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { GeocodingModule } from '../geocoding/geocoding.module';

@Module({
  imports: [PrismaModule, GeocodingModule],
  controllers: [CenterController, DashboardController],
  providers: [CenterService, DashboardService],
  exports: [CenterService],
})
export class CenterModule {}
