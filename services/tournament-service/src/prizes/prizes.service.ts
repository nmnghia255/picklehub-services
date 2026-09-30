import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrizeDto } from './dto/create-prize.dto';
import { UpdatePrizeDto } from './dto/update-prize.dto';

@Injectable()
export class PrizesService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyTournamentExists(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }
    return tournament;
  }

  private async verifyEventExists(tournamentId: number, eventId: number) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in tournament ${tournamentId}`);
    }
    return event;
  }

  async create(tournamentId: number, createDto: CreatePrizeDto) {
    await this.verifyTournamentExists(tournamentId);

    if (createDto.eventId) {
      await this.verifyEventExists(tournamentId, createDto.eventId);
    }

    return this.prisma.prize.create({
      data: {
        ...createDto,
        tournamentId,
      },
    });
  }

  async findAll(tournamentId: number, eventId?: number) {
    await this.verifyTournamentExists(tournamentId);

    return this.prisma.prize.findMany({
      where: {
        tournamentId,
        ...(eventId ? { eventId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tournamentId: number, id: number) {
    const prize = await this.prisma.prize.findUnique({
      where: { id },
    });
    if (!prize || prize.tournamentId !== tournamentId) {
      throw new NotFoundException(`Prize with ID ${id} not found in tournament ${tournamentId}`);
    }
    return prize;
  }

  async update(tournamentId: number, id: number, updateDto: UpdatePrizeDto) {
    await this.findOne(tournamentId, id);

    if (updateDto.eventId) {
      await this.verifyEventExists(tournamentId, updateDto.eventId);
    }

    return this.prisma.prize.update({
      where: { id },
      data: updateDto,
    });
  }

  async remove(tournamentId: number, id: number) {
    const prize = await this.findOne(tournamentId, id);

    return this.prisma.$transaction(async (tx) => {
      // Clean up any automated transaction logs for this prize
      await tx.financialTransaction.deleteMany({
        where: {
          tournamentId,
          description: {
            startsWith: `Prize ID: ${id} Award`,
          },
        },
      });

      return tx.prize.delete({
        where: { id },
      });
    });
  }

  async awardPrize(tournamentId: number, id: number, winnerTeamId: number | null) {
    const prize = await this.findOne(tournamentId, id);

    if (winnerTeamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: winnerTeamId, tournamentId },
      });
      if (!team) {
        throw new NotFoundException(`Team with ID ${winnerTeamId} not found in tournament ${tournamentId}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete previous automated financial transaction for this prize award (if any)
      await tx.financialTransaction.deleteMany({
        where: {
          tournamentId,
          description: {
            startsWith: `Prize ID: ${id} Award`,
          },
        },
      });

      // 2. If awarding to a team and rewardType is cash, record the expense
      if (winnerTeamId && prize.rewardType === 'cash' && prize.value > 0) {
        await tx.financialTransaction.create({
          data: {
            tournamentId,
            description: `Prize ID: ${id} Award to Team: ${winnerTeamId} - ${prize.name}`,
            type: 'expense',
            amount: prize.value,
            status: 'completed',
          },
        });
      }

      // 3. Update the Prize record
      return tx.prize.update({
        where: { id },
        data: { winnerTeamId },
      });
    });
  }
}
