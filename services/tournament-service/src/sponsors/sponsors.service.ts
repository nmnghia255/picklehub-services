import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';

@Injectable()
export class SponsorsService {
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

  async create(tournamentId: number, createDto: CreateSponsorDto) {
    await this.verifyTournamentExists(tournamentId);

    return this.prisma.$transaction(async (tx) => {
      const sponsor = await tx.sponsor.create({
        data: {
          ...createDto,
          tournamentId,
        },
      });

      // Create financial transaction with status 'completed' and type 'income'
      await tx.financialTransaction.create({
        data: {
          tournamentId,
          description: `Sponsor ID: ${sponsor.id} - ${sponsor.name}`,
          type: 'income',
          amount: sponsor.amount,
          status: 'completed',
        },
      });

      return sponsor;
    });
  }

  async findAll(tournamentId: number) {
    await this.verifyTournamentExists(tournamentId);

    return this.prisma.sponsor.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tournamentId: number, id: number) {
    const sponsor = await this.prisma.sponsor.findUnique({
      where: { id },
    });
    if (!sponsor || sponsor.tournamentId !== tournamentId) {
      throw new NotFoundException(`Sponsor with ID ${id} not found in tournament ${tournamentId}`);
    }
    return sponsor;
  }

  async update(tournamentId: number, id: number, updateDto: UpdateSponsorDto) {
    // Verify existence
    await this.findOne(tournamentId, id);

    return this.prisma.$transaction(async (tx) => {
      const updatedSponsor = await tx.sponsor.update({
        where: { id },
        data: updateDto,
      });

      // Update or create financial transaction if it exists or needs update
      const txRecord = await tx.financialTransaction.findFirst({
        where: {
          tournamentId,
          description: {
            startsWith: `Sponsor ID: ${id} `,
          },
        },
      });

      if (txRecord) {
        await tx.financialTransaction.update({
          where: { id: txRecord.id },
          data: {
            description: `Sponsor ID: ${updatedSponsor.id} - ${updatedSponsor.name}`,
            amount: updatedSponsor.amount,
          },
        });
      } else {
        await tx.financialTransaction.create({
          data: {
            tournamentId,
            description: `Sponsor ID: ${updatedSponsor.id} - ${updatedSponsor.name}`,
            type: 'income',
            amount: updatedSponsor.amount,
            status: 'completed',
          },
        });
      }

      return updatedSponsor;
    });
  }

  async remove(tournamentId: number, id: number) {
    // Verify existence
    await this.findOne(tournamentId, id);

    return this.prisma.$transaction(async (tx) => {
      // Clean up any automated transaction logs for this sponsor
      await tx.financialTransaction.deleteMany({
        where: {
          tournamentId,
          description: {
            startsWith: `Sponsor ID: ${id} `,
          },
        },
      });

      return tx.sponsor.delete({
        where: { id },
      });
    });
  }
}
