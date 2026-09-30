import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentOrganizerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('User is not authenticated');
    }

    const params = request.params;
    const tournamentIdStr = params.tournamentId || params.id;

    if (!tournamentIdStr) {
      throw new ForbiddenException('Tournament ID is required for this action');
    }

    const tournamentId = parseInt(tournamentIdStr, 10);
    if (isNaN(tournamentId)) {
      throw new NotFoundException('Tournament not found');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.organizerId !== user.sub) {
      throw new ForbiddenException('You are not the organizer of this tournament');
    }

    return true;
  }
}
