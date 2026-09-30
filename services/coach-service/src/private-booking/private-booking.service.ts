import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePrivateBookingDto } from './dto/create-private-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { UploadBookingProofDto } from './dto/upload-booking-proof.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { AuthIntegrationService } from '../auth-integration/auth-integration.service';
import { SportCenterIntegrationService } from '../sport-center-integration/sport-center-integration.service';

// Fields to always include when returning bookings to the learner
const LEARNER_BOOKING_INCLUDE = {
  coachProfile: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      verificationStatus: true,
      locationCity: true,
      hourlyRateVnd: true,
      paymentAccountName: true,
      paymentAccountNumber: true,
      paymentBankName: true,
      paymentQrUrl: true,
    },
  },
} as const;

@Injectable()
export class PrivateBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authIntegration: AuthIntegrationService,
    private readonly sportCenterIntegration: SportCenterIntegrationService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

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

  private async getBookingOrThrow(bookingId: string) {
    const booking = await this.prisma.privateBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  private assertCoachOwns(booking: { coachProfileId: string }, coachProfileId: string) {
    if (booking.coachProfileId !== coachProfileId) {
      throw new ForbiddenException('You do not own this booking.');
    }
  }

  private assertLearnerOwns(booking: { learnerId: string }, learnerId: string) {
    if (booking.learnerId !== learnerId) {
      throw new ForbiddenException('You do not own this booking.');
    }
  }

  // ─── Learner: Request a booking ────────────────────────────────────────────

  async createBooking(learnerId: string, coachId: string, dto: CreatePrivateBookingDto) {
    const coach = await this.prisma.coachProfile.findFirst({
      where: { id: coachId, status: 'ACTIVE' },
      select: { id: true, hourlyRateVnd: true, userId: true },
    });
    if (!coach) {
      throw new NotFoundException('Coach not found or not publicly available.');
    }
    if (!coach.hourlyRateVnd) {
      throw new BadRequestException('This coach has not set an hourly rate yet.');
    }

    // Snapshot price: (durationMinutes / 60) * hourlyRateVnd, rounded to nearest 1000 VND
    const priceVnd = Math.round((dto.durationMinutes / 60) * coach.hourlyRateVnd / 1000) * 1000;

    // ─── Resolve court link (if provided) ──────────────────────────────────────
    let courtId: string | undefined = dto.courtId;
    let courtCostVnd: number | undefined;
    let locationDescription: string | undefined = dto.locationDescription;

    if (dto.courtBookingId) {
      // Validate that the sport-center booking belongs to the COACH (playerId === coach.userId)
      const sportCenterBooking = await this.sportCenterIntegration.validateAndGetCourtBooking(
        dto.courtBookingId,
        coach.userId,   // ← coach's auth userId, not the learner's
        dto.courtId,
      );
      // Snapshot cost from the sport-center booking at the time of linking
      courtCostVnd = sportCenterBooking.totalPrice;
      // If no explicit courtId given, pick the first court from the booking
      if (!courtId && sportCenterBooking.bookingItems.length > 0) {
        courtId = sportCenterBooking.bookingItems[0].courtId;
      }
      // Court link takes precedence over free-text location
      locationDescription = undefined;
    }

    const booking = await this.prisma.privateBooking.create({
      data: {
        coachProfileId: coachId,
        learnerId,
        sessionAt: new Date(dto.sessionAt),
        durationMinutes: dto.durationMinutes,
        priceVnd,
        learnerNote: dto.learnerNote,
        status: 'PENDING_CONFIRMATION',
        // Location fields:
        ...(dto.courtBookingId ? { courtBookingId: dto.courtBookingId } : {}),
        ...(courtId ? { courtId } : {}),
        ...(courtCostVnd !== undefined ? { courtCostVnd } : {}),
        ...(locationDescription ? { locationDescription } : {}),
        // paymentStatus is intentionally null here — payment is only relevant after the coach confirms
      },
      include: LEARNER_BOOKING_INCLUDE,
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(booking);
  }

  // ─── Learner: List my outgoing bookings ────────────────────────────────────

  async listLearnerBookings(learnerId: string, query: ListBookingsQueryDto) {
    const { status, from, to, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const where: any = { learnerId };
    if (status) where.status = status;
    if (from || to) {
      where.sessionAt = {};
      if (from) where.sessionAt.gte = new Date(from);
      if (to) where.sessionAt.lte = new Date(to);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.privateBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sessionAt: 'asc' }, // upcoming sessions first
        include: LEARNER_BOOKING_INCLUDE,
      }),
      this.prisma.privateBooking.count({ where }),
    ]);

    const enrichedData = await this.authIntegration.enrichWithLearnerProfiles(data);
    return { data: enrichedData, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Learner: Upload payment proof ─────────────────────────────────────────

  async uploadPaymentProof(learnerId: string, bookingId: string, dto: UploadBookingProofDto) {
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertLearnerOwns(booking, learnerId);

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Payment can only be submitted for CONFIRMED bookings.');
    }
    if (booking.paymentStatus === 'SETTLED') {
      throw new BadRequestException('Payment is already settled.');
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: {
        paymentProofUrl: dto.paymentProofUrl,
        proofUploadedAt: new Date(),
        paymentStatus: 'PENDING_REVIEW',
      },
      include: LEARNER_BOOKING_INCLUDE,
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Learner: Cancel a booking ─────────────────────────────────────────────

  async learnerCancelBooking(learnerId: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertLearnerOwns(booking, learnerId);

    if (!['PENDING_CONFIRMATION', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel a booking with status ${booking.status}.`,
      );
    }
    if (booking.paymentStatus === 'SETTLED') {
      throw new BadRequestException('Cannot cancel a booking that has already been paid.');
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelReason: 'Cancelled by learner.' },
      include: LEARNER_BOOKING_INCLUDE,
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: List incoming bookings ─────────────────────────────────────────

  async listCoachBookings(userId: string, query: ListBookingsQueryDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    const { status, from, to, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const where: any = { coachProfileId };
    if (status) where.status = status;
    if (from || to) {
      where.sessionAt = {};
      if (from) where.sessionAt.gte = new Date(from);
      if (to) where.sessionAt.lte = new Date(to);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.privateBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sessionAt: 'asc' }, // upcoming sessions first
      }),
      this.prisma.privateBooking.count({ where }),
    ]);

    const enrichedData = await this.authIntegration.enrichWithLearnerProfiles(data);
    return { data: enrichedData, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Coach: Confirm a booking ──────────────────────────────────────────────

  async confirmBooking(userId: string, bookingId: string, dto: ConfirmBookingDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertCoachOwns(booking, coachProfileId);

    if (booking.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException(
        `Only PENDING_CONFIRMATION bookings can be confirmed. Current status: ${booking.status}.`,
      );
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PENDING_PROOF', // now the learner knows to pay
        coachNote: dto.coachNote,
      },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: Reject a booking ───────────────────────────────────────────────

  async rejectBooking(userId: string, bookingId: string, dto: RejectBookingDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertCoachOwns(booking, coachProfileId);

    if (booking.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException(
        `Only PENDING_CONFIRMATION bookings can be rejected. Current status: ${booking.status}.`,
      );
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: {
        status: 'REJECTED',
        cancelReason: dto.cancelReason,
      },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: Settle payment ─────────────────────────────────────────────────

  async settlePayment(userId: string, bookingId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertCoachOwns(booking, coachProfileId);

    if (booking.paymentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('Payment must be PENDING_REVIEW to settle.');
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'SETTLED', settledAt: new Date() },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: Complete a booking (session done) ──────────────────────────────

  async completeBooking(userId: string, bookingId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertCoachOwns(booking, coachProfileId);

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only CONFIRMED bookings can be marked as completed.');
    }
    if (booking.paymentStatus !== 'SETTLED') {
      throw new BadRequestException('Payment must be SETTLED before marking a booking as completed.');
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: Reject payment proof ──────────────────────────────────────────

  async rejectBookingPayment(userId: string, bookingId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertCoachOwns(booking, coachProfileId);

    if (booking.paymentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('Payment must be PENDING_REVIEW to reject.');
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'REJECTED',
        paymentProofUrl: null,
        // proofUploadedAt kept as audit history of when the proof was submitted
        settledAt: null,
      },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: Cancel a confirmed booking ────────────────────────────────────

  async coachCancelBooking(userId: string, bookingId: string, dto: RejectBookingDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertCoachOwns(booking, coachProfileId);

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only CONFIRMED bookings can be cancelled by the coach.');
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.cancelReason ?? 'Cancelled by coach.',
      },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: Link or update venue / court on an existing booking ────────────

  async updateBookingLocation(
    userId: string,
    bookingId: string,
    dto: import('../common/dto/update-session-location.dto').UpdateSessionLocationDto,
  ) {
    const coachProfileId = await this.resolveProfileId(userId);
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertCoachOwns(booking, coachProfileId);

    if (['CANCELLED', 'COMPLETED'].includes(booking.status)) {
      throw new BadRequestException(
        `Cannot update the location of a ${booking.status} booking.`,
      );
    }

    let courtId: string | null = null;
    let courtCostVnd: number | null = null;
    let locationDescription: string | null = null;
    let courtBookingId: string | null = null;

    if (dto.courtBookingId) {
      // Validate ownership and status via sport-center-service
      const sportCenterBooking = await this.sportCenterIntegration.validateAndGetCourtBooking(
        dto.courtBookingId,
        userId,
        dto.courtId,
      );
      courtBookingId = dto.courtBookingId;
      courtCostVnd = sportCenterBooking.totalPrice;
      courtId = dto.courtId ?? (sportCenterBooking.bookingItems[0]?.courtId ?? null);
      // Court link takes precedence — wipe free-text
      locationDescription = null;
    } else {
      // Free-text mode — wipe any existing court link
      locationDescription = dto.locationDescription ?? null;
      courtBookingId = null;
      courtId = null;
      courtCostVnd = null;
    }

    const updated = await this.prisma.privateBooking.update({
      where: { id: bookingId },
      data: { courtBookingId, courtId, courtCostVnd, locationDescription },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }
}

