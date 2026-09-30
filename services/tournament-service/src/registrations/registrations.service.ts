import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { RegistrationStatus, TournamentStatus, EventType, Gender } from '@prisma/client';
import { DuprService } from './dupr.service';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { NotificationClient } from '../clients/notification.client';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private prisma: PrismaService,
    private duprService: DuprService,
    private notificationClient: NotificationClient,
    private readonly tournamentsService: TournamentsService,
  ) {}

  private mapToResponseDto(reg: any): RegistrationResponseDto {
    return {
      id: reg.id,
      tournamentId: reg.tournamentId,
      eventId: reg.eventId,
      player: {
        id: reg.playerId,
        name: reg.playerName,
        rating: reg.playerRating,
        avatar: reg.playerAvatar || undefined,
        age: reg.playerAge || undefined,
        gender: reg.playerGender || undefined,
        duprId: reg.playerDuprId,
      },
      partner: reg.partnerId ? {
        id: reg.partnerId,
        name: reg.partnerName,
        rating: reg.partnerRating,
        avatar: reg.partnerAvatar || undefined,
        age: reg.partnerAge || undefined,
        gender: reg.partnerGender || undefined,
        duprId: reg.partnerDuprId,
      } : null,
      event: reg.event?.name || '',
      paymentStatus: reg.paymentStatus,
      paymentProofUrl: reg.paymentProofUrl,
      paymentProofUploadedAt: reg.paymentProofUploadedAt,
      status: reg.status,
      registrationDate: reg.registrationDate,
    };
  }

  private async findRaw(tournamentId: number, registrationId: number) {
    const registration = await this.prisma.registration.findFirst({
      where: { id: registrationId, tournamentId },
      include: { event: true },
    });
    if (!registration) {
      throw new NotFoundException(
        `Registration with ID ${registrationId} not found in tournament ${tournamentId}`,
      );
    }
    return registration;
  }

  async create(tournamentId: number, eventId: number, createDto: CreateRegistrationDto): Promise<RegistrationResponseDto> {
    // 1. Verify tournament exists and is open for registration
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }
    if (tournament.status !== TournamentStatus.open_registration) {
      throw new BadRequestException(
        `Tournament is currently in "${tournament.status}" status. Registrations are only allowed in "open_registration" status.`,
      );
    }

    const now = new Date();
    if (tournament.registrationStartDate && now < tournament.registrationStartDate) {
      throw new BadRequestException('Registration for this tournament has not started yet.');
    }
    if (tournament.registrationEndDate && now > tournament.registrationEndDate) {
      throw new BadRequestException('Registration for this tournament has closed.');
    }

    // 2. Verify event exists in this tournament
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in tournament ${tournamentId}`);
    }

    // Validate that Singles events do not accept partner information
    if (event.type === EventType.Singles) {
      if (createDto.partnerId || createDto.partnerName || createDto.partnerGender || createDto.partnerAge) {
        throw new BadRequestException('Partner information is not allowed for Singles events');
      }
    }

    // Validate that Doubles events require partner information
    if (event.type === EventType.Doubles) {
      if (!createDto.partnerId || !createDto.partnerName || !createDto.partnerGender) {
        throw new BadRequestException('Partner information (ID, name, and gender) is required for Doubles events');
      }
    }

    // 3. Verify event capacity is not exceeded for approved registrations
    if (event.participants >= event.capacity) {
      throw new BadRequestException(`The event "${event.name}" is already full.`);
    }

    // 4. Prevent duplicate registration for the same player in the same event
    const existingReg = await this.prisma.registration.findFirst({
      where: {
        tournamentId,
        eventId,
        playerId: createDto.playerId,
        status: { notIn: [RegistrationStatus.withdrawn, RegistrationStatus.rejected] },
      },
    });
    if (existingReg) {
      throw new BadRequestException(`Player is already registered for this event.`);
    }

    // 5. Execute registration and initial transaction creation in a database transaction
    return this.prisma.$transaction(async (tx) => {
      // Validate gender and capacity constraints based on the event's gender policy
      if (event.gender === Gender.Mixed) {
        if (createDto.partnerId || createDto.partnerName) {
          if (!createDto.partnerGender) {
            throw new BadRequestException('Partner gender is required for doubles registration in a Mixed event');
          }
          if (createDto.playerGender === createDto.partnerGender) {
            throw new BadRequestException('Mixed doubles requires partners of different genders');
          }
        }

        const activeRegistrations = await tx.registration.findMany({
          where: {
            eventId,
            status: { notIn: [RegistrationStatus.withdrawn, RegistrationStatus.rejected] },
          },
        });

        let totalMales = 0;
        let totalFemales = 0;
        for (const reg of activeRegistrations) {
          if (reg.playerGender === 'M') totalMales++;
          if (reg.partnerGender === 'M') totalMales++;
          if (reg.playerGender === 'F') totalFemales++;
          if (reg.partnerGender === 'F') totalFemales++;
        }

        const newM = (createDto.playerGender === 'M' ? 1 : 0) + (createDto.partnerGender === 'M' ? 1 : 0);
        const newF = (createDto.playerGender === 'F' ? 1 : 0) + (createDto.partnerGender === 'F' ? 1 : 0);

        if (totalMales + newM > event.capacity) {
          throw new BadRequestException('Registration failed: Male capacity limit reached for this Mixed event.');
        }
        if (totalFemales + newF > event.capacity) {
          throw new BadRequestException('Registration failed: Female capacity limit reached for this Mixed event.');
        }
      } else if (event.gender === Gender.Men) {
        if (createDto.playerGender !== 'M') {
          throw new BadRequestException('Only male players can register for Men\'s events');
        }
        if ((createDto.partnerId || createDto.partnerName) && createDto.partnerGender !== 'M') {
          throw new BadRequestException('Partner must be male for Men\'s events');
        }
      } else if (event.gender === Gender.Women) {
        if (createDto.playerGender !== 'F') {
          throw new BadRequestException('Only female players can register for Women\'s events');
        }
        if ((createDto.partnerId || createDto.partnerName) && createDto.partnerGender !== 'F') {
          throw new BadRequestException('Partner must be female for Women\'s events');
        }
      }

      let verifiedPlayerRating = createDto.playerRating;
      if (createDto.playerDuprId) {
        verifiedPlayerRating = await this.duprService.verifyOrFetchRating(createDto.playerDuprId, createDto.playerRating);
      }

      let verifiedPartnerRating = createDto.partnerRating;
      if (createDto.partnerDuprId && createDto.partnerRating !== undefined) {
        verifiedPartnerRating = await this.duprService.verifyOrFetchRating(createDto.partnerDuprId, createDto.partnerRating);
      }

      const registration = await tx.registration.create({
        data: {
          tournamentId,
          eventId,
          playerId: createDto.playerId,
          playerName: createDto.playerName,
          playerRating: verifiedPlayerRating,
          playerAvatar: createDto.playerAvatar,
          playerAge: createDto.playerAge,
          playerGender: createDto.playerGender,
          playerDuprId: createDto.playerDuprId,
          partnerId: createDto.partnerId,
          partnerName: createDto.partnerName,
          partnerRating: verifiedPartnerRating,
          partnerAvatar: createDto.partnerAvatar,
          partnerAge: createDto.partnerAge,
          partnerGender: createDto.partnerGender,
          partnerDuprId: createDto.partnerDuprId,
          paymentStatus: createDto.paymentStatus,
          status: RegistrationStatus.pending,
        },
      });

      // Log the initial financial transaction
      await tx.financialTransaction.create({
        data: {
          tournamentId,
          description: `Registration fee (Reg ID: ${registration.id}) - Player: ${createDto.playerName}`,
          type: 'income',
          amount: event.entryFee,
          status: createDto.paymentStatus,
        },
      });

      // Attach event relation for mapping
      (registration as any).event = event;

      const responseDto = this.mapToResponseDto(registration);

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'REGISTRATION_CREATE',
          newValue: responseDto as any,
        },
      });

      return responseDto;
    });
  }

  async findAll(tournamentId: number, eventId?: number, status?: RegistrationStatus): Promise<RegistrationResponseDto[]> {
    const filter: any = { tournamentId };
    if (eventId !== undefined) {
      filter.eventId = eventId;
    }
    if (status !== undefined) {
      filter.status = status;
    }

    const list = await this.prisma.registration.findMany({
      where: filter,
      include: { event: true },
      orderBy: { registrationDate: 'desc' },
    });
    return list.map((reg) => this.mapToResponseDto(reg));
  }

  async findOne(tournamentId: number, registrationId: number): Promise<RegistrationResponseDto> {
    const registration = await this.findRaw(tournamentId, registrationId);
    return this.mapToResponseDto(registration);
  }

  async update(tournamentId: number, registrationId: number, updateDto: UpdateRegistrationDto): Promise<RegistrationResponseDto> {
    const existing = await this.findRaw(tournamentId, registrationId);

    const result = await this.prisma.$transaction(async (tx) => {
      let paymentStatus = existing.paymentStatus;
      let status = existing.status;

      // 1. Handle Payment Status Update
      if (updateDto.paymentStatus && updateDto.paymentStatus !== existing.paymentStatus) {
        paymentStatus = updateDto.paymentStatus;
        
        // Update the status of the related financial transaction as well
        const txs = await tx.financialTransaction.findMany({
          where: {
            tournamentId,
            description: {
              contains: `Reg ID: ${registrationId}`,
            },
          },
        });
        for (const t of txs) {
          await tx.financialTransaction.update({
            where: { id: t.id },
            data: { status: updateDto.paymentStatus },
          });
        }
      }

      // 2. Handle Registration Status Transition
      if (updateDto.status && updateDto.status !== existing.status) {
        status = updateDto.status;

        // If transitioning to APPROVED:
        if (status === RegistrationStatus.approved) {

          const event = await tx.tournamentEvent.findUnique({
            where: { id: existing.eventId },
          });
          if (!event) throw new NotFoundException('Event not found');

          // Capacity check
          if (event.participants >= event.capacity) {
            throw new BadRequestException('Cannot approve: Event capacity reached.');
          }

          // Check gender capacity limits if event is Mixed and transitioning from inactive to active
          const wasActive = existing.status !== RegistrationStatus.withdrawn && existing.status !== RegistrationStatus.rejected;
          if (!wasActive && event.gender === Gender.Mixed) {
            const activeRegistrations = await tx.registration.findMany({
              where: {
                eventId: existing.eventId,
                status: { notIn: [RegistrationStatus.withdrawn, RegistrationStatus.rejected] },
              },
            });

            let totalMales = 0;
            let totalFemales = 0;
            for (const reg of activeRegistrations) {
              if (reg.playerGender === 'M') totalMales++;
              if (reg.partnerGender === 'M') totalMales++;
              if (reg.playerGender === 'F') totalFemales++;
              if (reg.partnerGender === 'F') totalFemales++;
            }

            const newM = (existing.playerGender === 'M' ? 1 : 0) + (existing.partnerGender === 'M' ? 1 : 0);
            const newF = (existing.playerGender === 'F' ? 1 : 0) + (existing.partnerGender === 'F' ? 1 : 0);

            if (totalMales + newM > event.capacity) {
              throw new BadRequestException('Cannot approve: Male capacity limit reached for this Mixed event.');
            }
            if (totalFemales + newF > event.capacity) {
              throw new BadRequestException('Cannot approve: Female capacity limit reached for this Mixed event.');
            }
          }

          // Create a Team record for Singles or Doubles event
          if (event.type === EventType.Singles || event.type === EventType.Doubles) {
            // Create a Team record
            const rating1 = existing.playerRating;
            const rating2 = existing.partnerRating || 0;
            const avgRating = event.type === EventType.Singles ? rating1 : (rating1 + rating2) / 2;

            await tx.team.create({
              data: {
                tournamentId,
                eventId: existing.eventId,
                player1Id: existing.playerId,
                player1Name: existing.playerName,
                player1Rating: rating1,
                player1Age: existing.playerAge,
                player1Gender: existing.playerGender,
                player1DuprId: existing.playerDuprId,
                player2Id: existing.partnerId,
                player2Name: existing.partnerName,
                player2Rating: existing.partnerId ? rating2 : null,
                player2Age: existing.partnerId ? existing.partnerAge : null,
                player2Gender: existing.partnerId ? existing.partnerGender : null,
                player2DuprId: existing.partnerId ? existing.partnerDuprId : null,
                avgRating,
              },
            });

            // Increment Event participants and Tournament registered counts
            await tx.tournamentEvent.update({
              where: { id: existing.eventId },
              data: { participants: { increment: 1 } },
            });

            await tx.tournament.update({
              where: { id: tournamentId },
              data: { registered: { increment: 1 } },
            });
          }
        }

        // If transitioning FROM approved to another state (withdrawn or rejected)
        if (existing.status === RegistrationStatus.approved && status !== RegistrationStatus.approved) {
          const event = await tx.tournamentEvent.findUnique({
            where: { id: existing.eventId },
          });
          if (!event) throw new NotFoundException('Event not found');

          if (event.type === EventType.Singles || event.type === EventType.Doubles) {
            // Find and delete the team record
            const team = await tx.team.findFirst({
              where: {
                tournamentId,
                eventId: existing.eventId,
                player1Id: existing.playerId,
                player2Id: existing.partnerId || undefined,
              },
            });
            if (team) {
              await tx.team.delete({ where: { id: team.id } });
            }

            // Decrement Event participants and Tournament registered counts
            await tx.tournamentEvent.update({
              where: { id: existing.eventId },
              data: { participants: { decrement: 1 } },
            });

            await tx.tournament.update({
              where: { id: tournamentId },
              data: { registered: { decrement: 1 } },
            });
          }
        }
      }

      // 3. Perform the actual registration update
      const updated = await tx.registration.update({
        where: { id: registrationId },
        data: {
          paymentStatus,
          status,
        },
        include: { event: true },
      });

      const responseDto = this.mapToResponseDto(updated);

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'REGISTRATION_STATUS_CHANGE',
          oldValue: this.mapToResponseDto(existing) as any,
          newValue: responseDto as any,
        },
      });

      return responseDto;
    });

    // Fire-and-forget notification delivery to keep HTTP responses highly responsive
    void this.handleRegistrationNotification(existing, result, updateDto);
    if (
      updateDto.status &&
      (existing.status === RegistrationStatus.approved ||
        updateDto.status === RegistrationStatus.approved) &&
      existing.status !== updateDto.status
    ) {
      this.tournamentsService.syncTournamentChat(tournamentId);
    }

    return result;
  }

  private async handleRegistrationNotification(existing: any, result: RegistrationResponseDto, updateDto: UpdateRegistrationDto) {
    try {
      if (existing.status === updateDto.status) return;

      const tournament = await this.prisma.tournament.findUnique({
        where: { id: result.tournamentId },
      });
      if (!tournament) return;

      if (!result.player.id) {
        this.logger.warn(`Cannot send registration notification: player ID is missing for registration ${result.id}`);
        return;
      }

      const playerEmail = await this.notificationClient.getUserEmail(result.player.id);
      const actionUrl = `${this.notificationClient.frontendUrl}/tournaments/${tournament.id}`;

      if (updateDto.status === RegistrationStatus.approved) {
        // Send email to player
        if (playerEmail) {
          await this.notificationClient.sendEmail(
            playerEmail,
            'tournament_registration_approved',
            {
              playerName: result.player.name,
              tournamentName: tournament.name,
              eventName: result.event,
              actionUrl,
            }
          );
        }

        // Send email to partner
        if (result.partner?.id) {
          const partnerEmail = await this.notificationClient.getUserEmail(result.partner.id);
          if (partnerEmail) {
            await this.notificationClient.sendEmail(
              partnerEmail,
              'tournament_registration_approved',
              {
                playerName: result.partner.name,
                tournamentName: tournament.name,
                eventName: result.event,
                actionUrl,
              }
            );
          }
        }

        // Send in-app notification
        const userIds = [result.player.id];
        if (result.partner?.id) {
          userIds.push(result.partner.id);
        }
        await this.notificationClient.sendInAppNotification(
          userIds,
          'Đăng ký giải đấu được duyệt',
          `Đơn đăng ký nội dung ${result.event} tại giải đấu ${tournament.name} của bạn đã được phê duyệt.`
        );

      } else if (updateDto.status === RegistrationStatus.rejected) {
        const reason = (updateDto as any).reason || 'Thông tin đăng ký không đáp ứng yêu cầu giải đấu';
        
        // Send email to player
        if (playerEmail) {
          await this.notificationClient.sendEmail(
            playerEmail,
            'tournament_registration_rejected',
            {
              playerName: result.player.name,
              tournamentName: tournament.name,
              eventName: result.event,
              reason,
              actionUrl,
            }
          );
        }

        // Send email to partner
        if (result.partner?.id) {
          const partnerEmail = await this.notificationClient.getUserEmail(result.partner.id);
          if (partnerEmail) {
            await this.notificationClient.sendEmail(
              partnerEmail,
              'tournament_registration_rejected',
              {
                playerName: result.partner.name,
                tournamentName: tournament.name,
                eventName: result.event,
                reason,
                actionUrl,
              }
            );
          }
        }

        // Send in-app notification
        const userIds = [result.player.id];
        if (result.partner?.id) {
          userIds.push(result.partner.id);
        }
        await this.notificationClient.sendInAppNotification(
          userIds,
          'Đăng ký giải đấu bị từ chối',
          `Đơn đăng ký nội dung ${result.event} tại giải đấu ${tournament.name} của bạn bị từ chối. Lý do: ${reason}.`
        );
      }
    } catch (error) {
      // Suppress notification exceptions from bubble-up, but log locally
      this.logger.error(`[RegistrationsService] Failed to dispatch registration notifications: ${error}`);
    }
  }

  async remove(tournamentId: number, registrationId: number): Promise<RegistrationResponseDto> {
    const existing = await this.findRaw(tournamentId, registrationId);

    if (existing.status === RegistrationStatus.approved) {
      throw new BadRequestException('Cannot delete an approved registration. Revert status first.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete corresponding transaction logs
      await tx.financialTransaction.deleteMany({
        where: {
          tournamentId,
          description: {
            contains: `Reg ID: ${registrationId}`,
          },
        },
      });

      const deleted = await tx.registration.delete({
        where: { id: registrationId },
        include: { event: true },
      });

      const responseDto = this.mapToResponseDto(deleted);

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'REGISTRATION_DELETE',
          oldValue: responseDto as any,
        },
      });

      return responseDto;
    });
  }

  async submitPaymentProof(tournamentId: number, registrationId: number, dto: SubmitPaymentProofDto): Promise<RegistrationResponseDto> {
    const existing = await this.findRaw(tournamentId, registrationId);

    if (existing.status !== RegistrationStatus.approved) {
      throw new BadRequestException('Cannot submit payment proof for a registration that is not approved.');
    }

    if (existing.paymentStatus === 'completed') {
      throw new BadRequestException('Payment is already completed.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update registration status and payment proof details
      const registration = await tx.registration.update({
        where: { id: registrationId },
        data: {
          paymentStatus: 'verifying',
          paymentProofUrl: dto.paymentProofUrl,
          paymentProofUploadedAt: new Date(),
        },
        include: { event: true },
      });

      // 2. Find and update the related financial transaction to 'verifying'
      const txs = await tx.financialTransaction.findMany({
        where: {
          tournamentId,
          description: {
            contains: `Reg ID: ${registrationId}`,
          },
        },
      });
      for (const t of txs) {
        await tx.financialTransaction.update({
          where: { id: t.id },
          data: { status: 'verifying' },
        });
      }

      const responseDto = this.mapToResponseDto(registration);

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'REGISTRATION_PAYMENT_PROOF',
          oldValue: this.mapToResponseDto(existing) as any,
          newValue: responseDto as any,
        },
      });

      return responseDto;
    });
  }
}
