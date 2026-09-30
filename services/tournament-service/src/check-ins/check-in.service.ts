import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationStatus } from '@prisma/client';

@Injectable()
export class CheckInService {
  constructor(private prisma: PrismaService) {}

  async performCheckIn(tournamentId: number, registrationId: number, playerRole: 'player1' | 'player2') {
    const registration = await this.prisma.registration.findFirst({
      where: { id: registrationId, tournamentId },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${registrationId} not found in tournament ${tournamentId}`);
    }

    if (registration.status !== RegistrationStatus.approved) {
      throw new BadRequestException('Cannot check in a player whose registration is not approved.');
    }

    if (playerRole === 'player2' && !registration.partnerId) {
      throw new BadRequestException('This registration does not have a partner (player2).');
    }

    const now = new Date();
    const updateData: any = {};

    if (playerRole === 'player1') {
      updateData.player1CheckedIn = true;
      updateData.player1CheckedInAt = now;
    } else {
      updateData.player2CheckedIn = true;
      updateData.player2CheckedInAt = now;
    }

    return this.prisma.checkIn.upsert({
      where: { registrationId },
      update: updateData,
      create: {
        tournamentId,
        registrationId,
        player1CheckedIn: playerRole === 'player1',
        player1CheckedInAt: playerRole === 'player1' ? now : null,
        player2CheckedIn: playerRole === 'player2',
        player2CheckedInAt: playerRole === 'player2' ? now : null,
      },
    });
  }

  async getCheckIns(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    return this.prisma.checkIn.findMany({
      where: { tournamentId },
      include: {
        registration: {
          select: {
            playerName: true,
            partnerName: true,
            event: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
