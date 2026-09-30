import { Module } from '@nestjs/common';
import { FavouriteController } from './favourite.controller';
import { FavouriteService } from './favourite.service';
import { CenterModule } from '../center/center.module';

@Module({
  imports: [CenterModule],
  controllers: [FavouriteController],
  providers: [FavouriteService],
})
export class FavouriteModule {}
