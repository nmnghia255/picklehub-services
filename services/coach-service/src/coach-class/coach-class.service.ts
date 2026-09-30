import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCoachClassDto } from './dto/create-coach-class.dto';
import { UpdateCoachClassDto } from './dto/update-coach-class.dto';
import { ListClassesQueryDto } from './dto/list-classes-query.dto';
import { ListMyClassesQueryDto } from './dto/list-my-classes-query.dto';

@Injectable()
export class CoachClassService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async assertOwnsClass(coachProfileId: string, classId: string) {
    const cls = await this.prisma.coachClass.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.coachProfileId !== coachProfileId) {
      throw new ForbiddenException('You do not own this class.');
    }
    return cls;
  }

  // ─── Coach endpoints ───────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCoachClassDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    return this.prisma.coachClass.create({
      data: {
        coachProfileId,
        title: dto.title,
        description: dto.description,
        level: dto.level,
        capacity: dto.capacity,
        priceVnd: dto.priceVnd,
        locationDescription: dto.locationDescription,
        coverImageUrl: dto.coverImageUrl,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: { schedules: true },
    });
  }

  async listMyClasses(userId: string, query: ListMyClassesQueryDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    const { status, level, from, to } = query;

    const where: any = { coachProfileId };
    if (status) where.status = status;
    if (level) where.level = level;
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate.gte = new Date(from);
      if (to) where.startDate.lte = new Date(to);
    }

    return this.prisma.coachClass.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        schedules: { orderBy: { scheduledAt: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async findMyClass(userId: string, classId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    await this.assertOwnsClass(coachProfileId, classId);
    return this.prisma.coachClass.findUnique({
      where: { id: classId },
      include: {
        schedules: { orderBy: { scheduledAt: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async update(userId: string, classId: string, dto: UpdateCoachClassDto) {
    const coachProfileId = await this.resolveProfileId(userId);
    const cls = await this.assertOwnsClass(coachProfileId, classId);

    if (cls.status !== 'DRAFT' && cls.status !== 'OPEN') {
      throw new BadRequestException('Only DRAFT or OPEN classes can be edited.');
    }

    return this.prisma.coachClass.update({
      where: { id: classId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.priceVnd !== undefined && { priceVnd: dto.priceVnd }),
        ...(dto.locationDescription !== undefined && { locationDescription: dto.locationDescription }),
        ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      },
      include: { schedules: { orderBy: { scheduledAt: 'asc' } } },
    });
  }

  async publish(userId: string, classId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    const cls = await this.assertOwnsClass(coachProfileId, classId);

    if (cls.status !== 'DRAFT') {
      throw new BadRequestException(`Class cannot be published — current status is ${cls.status}.`);
    }

    return this.prisma.coachClass.update({
      where: { id: classId },
      data: { status: 'OPEN' },
      include: { schedules: { orderBy: { scheduledAt: 'asc' } } },
    });
  }

  async cancel(userId: string, classId: string) {
    const coachProfileId = await this.resolveProfileId(userId);
    const cls = await this.assertOwnsClass(coachProfileId, classId);

    if (cls.status === 'CANCELLED' || cls.status === 'COMPLETED') {
      throw new BadRequestException(`Class is already ${cls.status} and cannot be cancelled.`);
    }

    return this.prisma.coachClass.update({
      where: { id: classId },
      data: { status: 'CANCELLED' },
      include: { schedules: { orderBy: { scheduledAt: 'asc' } } },
    });
  }

  // ─── Public endpoints ──────────────────────────────────────────────────────

  async listPublic(query: ListClassesQueryDto) {
    const { city, level, from, to, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { status: 'OPEN' };
    if (city) {
      where.coachProfile = { locationCity: { contains: city, mode: 'insensitive' } };
    }
    if (level) where.level = level;
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate.gte = new Date(from);
      if (to) where.startDate.lte = new Date(to);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.coachClass.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'asc' }, // upcoming classes first
        include: {
          coachProfile: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              verificationStatus: true,
              locationCity: true,
              paymentAccountName: true,
              paymentAccountNumber: true,
              paymentBankName: true,
              paymentQrUrl: true,
            },
          },
          schedules: { orderBy: { scheduledAt: 'asc' }, take: 3 },
        },
      }),
      this.prisma.coachClass.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOnePublic(classId: string) {
    const cls = await this.prisma.coachClass.findFirst({
      where: { id: classId, status: { in: ['OPEN', 'ONGOING'] } },
      include: {
        coachProfile: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            verificationStatus: true,
            locationCity: true,
            paymentAccountName: true,
            paymentAccountNumber: true,
            paymentBankName: true,
            paymentQrUrl: true,
          },
        },
        schedules: { orderBy: { scheduledAt: 'asc' } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found or not currently open.');
    return cls;
  }

  async listPublicByCoach(coachId: string) {
    return this.prisma.coachClass.findMany({
      where: { coachProfileId: coachId, status: { in: ['OPEN', 'ONGOING'] } },
      orderBy: { createdAt: 'desc' },
      include: { schedules: { orderBy: { scheduledAt: 'asc' }, take: 3 } },
    });
  }
}
