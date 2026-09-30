import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { ReviewCertificationDto } from './dto/review-certification.dto';
import { ListCertificationsQueryDto } from './dto/list-certifications-query.dto';

@Injectable()
export class CoachCertificationService {
  constructor(private readonly prisma: PrismaService) {}

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

  async addCertification(userId: string, dto: CreateCertificationDto) {
    const coachProfileId = await this.resolveProfileId(userId);

    return this.prisma.coachCertification.create({
      data: {
        coachProfileId,
        name: dto.name,
        issuingOrganization: dto.issuingOrganization,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        documentUrl: dto.documentUrl,
      },
    });
  }

  async listMyCertifications(userId: string) {
    const coachProfileId = await this.resolveProfileId(userId);

    return this.prisma.coachCertification.findMany({
      where: { coachProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeCertification(userId: string, certId: string) {
    const coachProfileId = await this.resolveProfileId(userId);

    const cert = await this.prisma.coachCertification.findUnique({
      where: { id: certId },
    });

    if (!cert) {
      throw new NotFoundException('Certification not found.');
    }
    if (cert.coachProfileId !== coachProfileId) {
      throw new ForbiddenException('You can only delete your own certifications.');
    }

    await this.prisma.coachCertification.delete({ where: { id: certId } });
    return { message: 'Certification removed successfully.' };
  }

  // ─── Admin endpoints ───

  async listAllCertifications(query: ListCertificationsQueryDto) {
    const { verificationStatus, coachProfileId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (coachProfileId) where.coachProfileId = coachProfileId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.coachCertification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          coachProfile: {
            select: { id: true, displayName: true, userId: true },
          },
        },
      }),
      this.prisma.coachCertification.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listPendingCertifications() {
    return this.prisma.coachCertification.findMany({
      where: { verificationStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        coachProfile: {
          select: { id: true, displayName: true, userId: true },
        },
      },
    });
  }

  async reviewCertification(
    adminUserId: string,
    certId: string,
    dto: ReviewCertificationDto,
  ) {
    const cert = await this.prisma.coachCertification.findUnique({
      where: { id: certId },
    });
    if (!cert) {
      throw new NotFoundException('Certification not found.');
    }

    return this.prisma.coachCertification.update({
      where: { id: certId },
      data: {
        verificationStatus: dto.verificationStatus as any,
        reviewedByUserId: adminUserId,
        reviewNote: dto.reviewNote,
      },
    });
  }
}
