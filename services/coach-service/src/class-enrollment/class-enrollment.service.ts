import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { AuthIntegrationService } from '../auth-integration/auth-integration.service';

@Injectable()
export class ClassEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authIntegration: AuthIntegrationService,
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

  private async assertCoachOwnsClass(coachProfileId: string, classId: string) {
    const cls = await this.prisma.coachClass.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.coachProfileId !== coachProfileId) {
      throw new ForbiddenException('You do not own this class.');
    }
    return cls;
  }

  // ─── Learner: Enroll ───────────────────────────────────────────────────────

  async enroll(learnerId: string, classId: string) {
    const cls = await this.prisma.coachClass.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.status !== 'OPEN') {
      throw new BadRequestException('This class is not open for enrollment.');
    }

    const existing = await this.prisma.classEnrollment.findUnique({
      where: { classId_learnerId: { classId, learnerId } },
    });
    if (existing && existing.status === 'ACTIVE') {
      throw new ConflictException('You are already enrolled in this class.');
    }

    // Check capacity only for new enrollments (re-enrollments after cancel already freed a slot)
    const isReEnroll = existing && existing.status === 'CANCELLED';
    if (!isReEnroll && cls.enrolledCount >= cls.capacity) {
      throw new BadRequestException('This class is full.');
    }

    const [enrollment] = await this.prisma.$transaction([
      this.prisma.classEnrollment.upsert({
        where: { classId_learnerId: { classId, learnerId } },
        create: {
          classId,
          learnerId,
          amountVnd: cls.priceVnd,
          status: 'ACTIVE',
          paymentStatus: 'PENDING_PROOF',
        },
        update: {
          status: 'ACTIVE',
          amountVnd: cls.priceVnd, // re-snapshot price in case it changed
          paymentStatus: 'PENDING_PROOF',
          paymentProofUrl: null,
          proofUploadedAt: null,
          settledAt: null,
          cancelledAt: null,
        },
      }),
      // Only increment enrolledCount for new enrollments.
      // Re-enrollments were already decremented when they cancelled, so increment again.
      this.prisma.coachClass.update({
        where: { id: classId },
        data: { enrolledCount: { increment: 1 } },
      }),
    ]);

    // Include coach bank info so learner knows where to transfer
    const coachProfile = await this.prisma.coachProfile.findUnique({
      where: { id: cls.coachProfileId },
      select: {
        paymentAccountName: true,
        paymentAccountNumber: true,
        paymentBankName: true,
        paymentQrUrl: true,
      },
    });

    return this.authIntegration.enrichSingleWithLearnerProfile({
      ...enrollment,
      coachPaymentInfo: coachProfile,
    });
  }

  // ─── Learner: My enrollments ───────────────────────────────────────────────

  async listMyEnrollments(learnerId: string) {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { learnerId },
      orderBy: { enrolledAt: 'desc' },
      include: {
        coachClass: {
          select: {
            id: true,
            title: true,
            level: true,
            priceVnd: true,
            locationDescription: true,
            coverImageUrl: true,
            status: true,
            coachProfile: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                paymentAccountName: true,
                paymentAccountNumber: true,
                paymentBankName: true,
                paymentQrUrl: true,
              },
            },
          },
        },
      },
    });
    return this.authIntegration.enrichWithLearnerProfiles(enrollments);
  }

  // ─── Learner: Upload payment proof ─────────────────────────────────────────

  async uploadPaymentProof(learnerId: string, enrollmentId: string, dto: UploadPaymentProofDto) {
    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found.');
    if (enrollment.learnerId !== learnerId) {
      throw new ForbiddenException('You can only update your own enrollment.');
    }
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException('Only active enrollments can upload a payment proof.');
    }
    if (enrollment.paymentStatus === 'SETTLED') {
      throw new BadRequestException('Payment is already settled.');
    }

    const updated = await this.prisma.classEnrollment.update({
      where: { id: enrollmentId },
      data: {
        paymentProofUrl: dto.paymentProofUrl,
        proofUploadedAt: new Date(),
        paymentStatus: 'PENDING_REVIEW',
      },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Learner: Cancel enrollment ────────────────────────────────────────────

  async cancelEnrollment(learnerId: string, enrollmentId: string) {
    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found.');
    if (enrollment.learnerId !== learnerId) {
      throw new ForbiddenException('You can only cancel your own enrollment.');
    }
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException('Only active enrollments can be cancelled.');
    }

    // Get current class to guard against enrolledCount going below 0
    const cls = await this.prisma.coachClass.findUnique({
      where: { id: enrollment.classId },
      select: { enrolledCount: true },
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.classEnrollment.update({
        where: { id: enrollmentId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      }),
      this.prisma.coachClass.update({
        where: { id: enrollment.classId },
        data: { enrolledCount: { decrement: cls && cls.enrolledCount > 0 ? 1 : 0 } },
      }),
    ]);

    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: View enrollments ───────────────────────────────────────────────

  async listClassEnrollments(userId: string, classId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    await this.assertCoachOwnsClass(coachProfileId, classId);

    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId },
      orderBy: { enrolledAt: 'desc' },
    });
    return this.authIntegration.enrichWithLearnerProfiles(enrollments);
  }

  // ─── Coach: Settle payment ─────────────────────────────────────────────────

  async settlePayment(userId: string, classId: string, enrollmentId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    await this.assertCoachOwnsClass(coachProfileId, classId);

    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment || enrollment.classId !== classId) {
      throw new NotFoundException('Enrollment not found in this class.');
    }
    if (enrollment.paymentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('Enrollment payment must be PENDING_REVIEW to settle.');
    }

    const updated = await this.prisma.classEnrollment.update({
      where: { id: enrollmentId },
      data: { paymentStatus: 'SETTLED', settledAt: new Date() },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }

  // ─── Coach: Reject payment ─────────────────────────────────────────────────

  async rejectPayment(userId: string, classId: string, enrollmentId: string, dto: RejectPaymentDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    await this.assertCoachOwnsClass(coachProfileId, classId);

    const enrollment = await this.prisma.classEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment || enrollment.classId !== classId) {
      throw new NotFoundException('Enrollment not found in this class.');
    }
    if (enrollment.paymentStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('Enrollment payment must be PENDING_REVIEW to reject.');
    }

    const updated = await this.prisma.classEnrollment.update({
      where: { id: enrollmentId },
      data: {
        paymentStatus: 'REJECTED',
        paymentProofUrl: null,
        // proofUploadedAt is intentionally kept as audit history of when the proof was submitted
        settledAt: null,
      },
    });
    return this.authIntegration.enrichSingleWithLearnerProfile(updated);
  }
}
