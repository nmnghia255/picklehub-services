import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CourtsService } from './courts.service';
import { CentersController } from './centers.controller';
import { CourtsController } from './courts.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CentersController, CourtsController],
  providers: [CourtsService],
  exports: [CourtsService],
})
export class CourtsModule {}
