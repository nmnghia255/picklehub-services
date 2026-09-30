import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationModule } from '../../../notification/notification.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';
import { UserModule } from '../../../user/user.module';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SocialParticipantModule } from '../../participant/social-participant.module';

@Module({
  imports: [ConfigModule, NotificationModule, UserModule, SocialParticipantModule],
  providers: [
    JwtAuthGuard,
    FinanceService,
    ExpenseService,
  ],
  controllers: [
    FinanceController,
    ExpenseController,
  ],
})
export class FinanceModule {}
