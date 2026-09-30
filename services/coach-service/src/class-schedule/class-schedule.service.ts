import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClassScheduleDto } from './dto/create-class-schedule.dto';
import { SportCenterIntegrationService } from '../sport-center-integration/sport-center-integration.service';

@Injectable()
export class ClassScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sportCenterIntegration: SportCenterIntegrationService,
  ) {}

  private async resolveProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Coach profile not found. Please register as a coach first.');
    }
    return profile.id;
  }

  private async assertOwnsClass(coachProfileId: string, classId: string) {
    const cls = await this.prisma.coachClass.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.coachProfileId !== coachProfileId) {
      throw new ForbiddenException('You do not own this class.');
    }
    return cls;
  }

  async addSchedule(userId: string, classId: string, dto: CreateClassScheduleDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    await this.assertOwnsClass(coachProfileId, classId);

    // ─── Resolve court link (if provided) ──────────────────────────────────────
    let resolvedCourtId: string | undefined = dto.courtId;
    let courtCostVnd: number | undefined;
    let locationDescription: string | undefined = dto.locationDescription;

    if (dto.courtBookingId) {
      // Validate: booking exists, is CONFIRMED, and belongs to this coach's userId
      const sportCenterBooking = await this.sportCenterIntegration.validateAndGetCourtBooking(
        dto.courtBookingId,
        userId,
        dto.courtId,
      );
      courtCostVnd = sportCenterBooking.totalPrice;
      if (!resolvedCourtId && sportCenterBooking.bookingItems.length > 0) {
        resolvedCourtId = sportCenterBooking.bookingItems[0].courtId;
      }
      // Court link takes precedence — clear free-text location
      locationDescription = undefined;
    }

    return this.prisma.classSchedule.create({
      data: {
        classId,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        topic: dto.topic,
        note: dto.note,
        ...(dto.courtBookingId ? { courtBookingId: dto.courtBookingId } : {}),
        ...(resolvedCourtId ? { courtId: resolvedCourtId } : {}),
        ...(courtCostVnd !== undefined ? { courtCostVnd } : {}),
        ...(locationDescription ? { locationDescription } : {}),
      },
    });
  }

  async listSchedules(userId: string, classId: string, from?: string, to?: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    await this.assertOwnsClass(coachProfileId, classId);

    const where: any = { classId };
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    return this.prisma.classSchedule.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async removeSchedule(userId: string, classId: string, scheduleId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    await this.assertOwnsClass(coachProfileId, classId);

    const schedule = await this.prisma.classSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule entry not found.');
    if (schedule.classId !== classId) {
      throw new ForbiddenException('Schedule entry does not belong to this class.');
    }

    await this.prisma.classSchedule.delete({ where: { id: scheduleId } });
    return { message: 'Schedule entry removed successfully.' };
  }

  // ─── Coach: Link or update venue / court on an existing schedule entry ─────

  async updateScheduleLocation(
    userId: string,
    classId: string,
    scheduleId: string,
    dto: import('../common/dto/update-session-location.dto').UpdateSessionLocationDto,
  ) {
    const coachProfileId = await this.resolveProfileId(userId);
    const cls = await this.assertOwnsClass(coachProfileId, classId);

    if (cls.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update location on a session belonging to a CANCELLED class.');
    }

    const schedule = await this.prisma.classSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule entry not found.');
    if (schedule.classId !== classId) {
      throw new ForbiddenException('Schedule entry does not belong to this class.');
    }

    let courtId: string | null = null;
    let courtCostVnd: number | null = null;
    let locationDescription: string | null = null;
    let courtBookingId: string | null = null;

    if (dto.courtBookingId) {
      const sportCenterBooking = await this.sportCenterIntegration.validateAndGetCourtBooking(
        dto.courtBookingId,
        userId,
        dto.courtId,
      );
      courtBookingId = dto.courtBookingId;
      courtCostVnd = sportCenterBooking.totalPrice;
      courtId = dto.courtId ?? (sportCenterBooking.bookingItems[0]?.courtId ?? null);
      locationDescription = null;
    } else {
      locationDescription = dto.locationDescription ?? null;
      courtBookingId = null;
      courtId = null;
      courtCostVnd = null;
    }

    return this.prisma.classSchedule.update({
      where: { id: scheduleId },
      data: { courtBookingId, courtId, courtCostVnd, locationDescription },
    });
  }
}

