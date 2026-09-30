import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamResponseDto } from './dto/team-response.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  private mapToResponseDto(team: any): TeamResponseDto {
    return {
      id: team.id,
      player1: {
        id: team.player1Id,
        name: team.player1Name,
        rating: team.player1Rating,
        avatar: undefined, // Fields not stored on team directly, default undefined
        age: team.player1Age || undefined,
        gender: team.player1Gender || undefined,
        duprId: team.player1DuprId,
      },
      player2: team.player2Id ? {
        id: team.player2Id,
        name: team.player2Name,
        rating: team.player2Rating,
        avatar: undefined,
        age: team.player2Age || undefined,
        gender: team.player2Gender || undefined,
        duprId: team.player2DuprId,
      } : null,
      avgRating: team.avgRating,
    };
  }

  async findAll(tournamentId: number, eventId: number): Promise<TeamResponseDto[]> {
    // Verify event exists
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in tournament ${tournamentId}`);
    }

    const list = await this.prisma.team.findMany({
      where: { tournamentId, eventId },
      orderBy: { id: 'asc' },
    });
    return list.map((team) => this.mapToResponseDto(team));
  }
}
