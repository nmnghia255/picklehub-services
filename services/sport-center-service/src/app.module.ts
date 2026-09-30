import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { CenterModule } from './center/center.module';
import { CourtModule } from './court/court.module';
import { BookingModule } from './booking/booking.module';
import { ServiceModule } from './service/service.module';
import { ProductModule } from './product/product.module';
import { PrismaModule } from './prisma.module';
import { ReviewModule } from './review/review.module';
import { FavouriteModule } from './favourite/favourite.module';
import { CustomerModule } from './customer/customer.module';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionGuard } from './guards/subscription.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CenterModule,
    CourtModule,
    BookingModule,
    ServiceModule,
    ProductModule,
    ReviewModule,
    FavouriteModule,
    CustomerModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule {}
