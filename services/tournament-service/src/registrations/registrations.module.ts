import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DuprService } from './dupr.service';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [PrismaModule, TournamentsModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, DuprService],
  exports: [RegistrationsService, DuprService],
})
export class RegistrationsModule {}
