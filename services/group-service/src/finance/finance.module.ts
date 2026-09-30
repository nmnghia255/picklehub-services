import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma.service';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { FinanceController, FinanceRefundController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ExpenseController } from './expense/expense.controller';
import { ExpenseService } from './expense/expense.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [NotificationModule, UserModule],
  providers: [
    PrismaService,
    AdminRoleGuard,
    FinanceService,
    ExpenseService,
  ],
  controllers: [
    FinanceController,
    FinanceRefundController,
    ExpenseController,
  ],
})
export class FinanceModule { }
