import { Module } from '@nestjs/common';
import { RefereesService } from './referees.service';
import { RefereesController, RefereesInternalController, RefereesInvitationController, RefereesInvitationManageController } from './referees.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [PrismaModule, ClientsModule, TournamentsModule],
  controllers: [RefereesController, RefereesInternalController, RefereesInvitationController, RefereesInvitationManageController],
  providers: [RefereesService],
  exports: [RefereesService],
})
export class RefereesModule {}
