import { Module } from '@nestjs/common';
import { CenterModule } from '../center/center.module';
import { CustomerController } from './customer.controller';

@Module({
  imports: [CenterModule],
  controllers: [CustomerController],
})
export class CustomerModule {}
