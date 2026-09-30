import { Module } from '@nestjs/common';
import { SessionAttendanceController } from './session-attendance.controller';
import { SessionAttendanceService } from './session-attendance.service';
import { PrismaService } from '../../prisma.service';
import { NotificationModule } from '../../notification/notification.module';
import { UserModule } from '../../user/user.module';

@Module({
  imports: [NotificationModule, UserModule],
  controllers: [SessionAttendanceController],
  providers: [SessionAttendanceService, PrismaService],
  exports: [SessionAttendanceService],
})
export class SessionAttendanceModule {}
