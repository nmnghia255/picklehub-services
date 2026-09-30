import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FinanceExportService } from './finance-export.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceExportService],
  exports: [FinanceService, FinanceExportService],
})
export class FinanceModule {}

