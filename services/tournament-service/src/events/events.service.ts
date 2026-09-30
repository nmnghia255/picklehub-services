import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { TournamentStatus, EventStatus } from '@prisma/client';
import { EventStage } from './dto/event-response.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) { }

  private async checkTournamentStatus(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }
    if (
      tournament.status === TournamentStatus.closed_registration ||
      tournament.status === TournamentStatus.in_progress ||
      tournament.status === TournamentStatus.completed
    ) {
      throw new BadRequestException(
        `Cannot modify events for a tournament that is ${tournament.status}`,
      );
    }
    return tournament;
  }

  async create(tournamentId: number, createEventDto: CreateEventDto) {
    await this.checkTournamentStatus(tournamentId);

    const duplicate = await this.prisma.tournamentEvent.findFirst({
      where: {
        tournamentId,
        name: {
          equals: createEventDto.name,
          mode: 'insensitive',
        },
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `An event with name "${createEventDto.name}" already exists in this tournament`,
      );
    }

    const created = await this.prisma.tournamentEvent.create({
      data: {
        ...createEventDto,
        tournamentId,
        status: EventStatus.open,
      },
    });
    return this.enrichEvent(created);
  }

  async findAll(tournamentId: number) {
    // Verify tournament exists
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    const events = await this.prisma.tournamentEvent.findMany({
      where: { tournamentId },
      orderBy: { id: 'asc' },
    });

    return Promise.all(events.map((event) => this.enrichEvent(event)));
  }

  async findOne(tournamentId: number, eventId: number) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(
        `Event with ID ${eventId} not found in tournament ${tournamentId}`,
      );
    }
    return this.enrichEvent(event);
  }

  async update(tournamentId: number, eventId: number, updateEventDto: UpdateEventDto) {
    await this.checkTournamentStatus(tournamentId);
    const existing = await this.findOne(tournamentId, eventId);

    if (updateEventDto.name !== undefined) {
      const duplicate = await this.prisma.tournamentEvent.findFirst({
        where: {
          tournamentId,
          name: {
            equals: updateEventDto.name,
            mode: 'insensitive',
          },
          NOT: {
            id: eventId,
          },
        },
      });
      if (duplicate) {
        throw new BadRequestException(
          `An event with name "${updateEventDto.name}" already exists in this tournament`,
        );
      }
    }

    if (updateEventDto.capacity !== undefined) {
      if (updateEventDto.capacity < existing.participants) {
        throw new BadRequestException(
          `Capacity cannot be less than current participants (${existing.participants})`,
        );
      }
    }

    const finalCapacity =
      updateEventDto.capacity !== undefined ? updateEventDto.capacity : existing.capacity;
    const status = existing.participants >= finalCapacity ? EventStatus.full : EventStatus.open;

    const updated = await this.prisma.tournamentEvent.update({
      where: { id: eventId },
      data: {
        ...updateEventDto,
        status,
      },
    });
    return this.enrichEvent(updated);
  }

  async remove(tournamentId: number, eventId: number) {
    await this.checkTournamentStatus(tournamentId);
    const existing = await this.findOne(tournamentId, eventId);

    if (existing.participants > 0) {
      throw new BadRequestException(
        'Cannot delete an event that already has registered participants',
      );
    }

    return this.prisma.tournamentEvent.delete({
      where: { id: eventId },
    });
  }

  private async enrichEvent(event: any) {
    if (!event) return null;
    const teamCount = await this.prisma.team.count({
      where: { eventId: event.id },
    });
    const totalMatches = this.calculatePredictedMatches(event, teamCount);

    const matches = await this.prisma.match.findMany({
      where: { eventId: event.id },
      select: { groupStage: true, status: true },
    });

    let currentStage = EventStage.REGISTRATION;
    if (matches.length > 0) {
      const groupMatches = matches.filter((m) => m.groupStage);
      const allGroupCompleted = groupMatches.every(
        (m) => m.status === 'completed' || m.status === 'walkover',
      );
      if (!allGroupCompleted) {
        currentStage = EventStage.GROUP_STAGE;
      } else {
        const knockoutMatches = matches.filter((m) => !m.groupStage);
        if (knockoutMatches.length === 0) {
          currentStage = EventStage.KNOCKOUT_READY;
        } else {
          const allKnockoutCompleted = knockoutMatches.every(
            (m) => m.status === 'completed' || m.status === 'walkover',
          );
          if (allKnockoutCompleted) {
            currentStage = EventStage.COMPLETED;
          } else {
            currentStage = EventStage.KNOCKOUT_STAGE;
          }
        }
      }
    }

    return {
      ...event,
      totalMatches,
      currentStage,
    };
  }

  private calculatePredictedMatches(event: any, teamCount: number): number | null {
    if (!event.numGroups || !event.totalAdvance) {
      return null;
    }

    if (teamCount < 2) return 0;

    const numGroups = event.numGroups;
    const totalAdvance = event.totalAdvance;

    const baseSize = Math.floor(teamCount / numGroups);
    const extraTeams = teamCount % numGroups;

    const numLargeGroups = extraTeams;
    const numSmallGroups = numGroups - extraTeams;

    const matchesInLargeGroup = ((baseSize + 1) * baseSize) / 2;
    const matchesInSmallGroup = (baseSize * (baseSize - 1)) / 2;

    const groupMatches =
      numLargeGroups * matchesInLargeGroup + numSmallGroups * matchesInSmallGroup;

    const advancingTeams = totalAdvance;
    let knockoutMatches = 0;
    if (advancingTeams >= 2) {
      let p = 1;
      while (p < advancingTeams) p *= 2;
      const bracketSize = Math.max(p, 2);
      knockoutMatches = bracketSize - 1;
    }

    return groupMatches + knockoutMatches;
  }
}
