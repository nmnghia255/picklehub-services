import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { BookingController } from './booking.controller';
import { BookingInternalController } from './booking-internal.controller';
import { BookingService } from './booking.service';
import { BookingCancelService } from './booking-cancel.service';
import { BookingTimeoutService } from './booking-timeout.service';
import { CreditService } from './credit.service';
import { OwnerBookingService } from './owner-booking.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { RevenueController } from './revenue.controller';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [BookingController, BookingInternalController, RevenueController],
  providers: [BookingService, BookingCancelService, BookingTimeoutService, CreditService, OwnerBookingService, PaymentTransactionService],
  exports: [BookingService, BookingCancelService, CreditService, OwnerBookingService, PaymentTransactionService],
})
export class BookingModule {}

