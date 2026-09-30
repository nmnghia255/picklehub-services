import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCoachProfileDto } from './dto/create-coach-profile.dto';
import { UpdateCoachProfileDto } from './dto/update-coach-profile.dto';
import { ListCoachesQueryDto } from './dto/list-coaches-query.dto';

@Injectable()
export class CoachProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCoachProfileDto) {
    const existing = await this.prisma.coachProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('A coach profile already exists for this user.');
    }

    return this.prisma.coachProfile.create({
      data: {
        userId,
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        level: dto.level,
        yearsExperience: dto.yearsExperience,
        specialties: dto.specialties ?? [],
        languages: dto.languages ?? [],
        locationCity: dto.locationCity,
        hourlyRateVnd: dto.hourlyRateVnd,
        paymentAccountName: dto.paymentAccountName,
        paymentAccountNumber: dto.paymentAccountNumber,
        paymentBankName: dto.paymentBankName,
        paymentQrUrl: dto.paymentQrUrl,
      },
      include: { certifications: true },
    });
  }

  async findMyProfile(userId: string) {
    const profile = await this.prisma.coachProfile.findUnique({
      where: { userId },
      include: { 
        certifications: true,
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException('Coach profile not found. Please register as a coach first.');
    }

    const reviewCount = profile._count.reviews;
    const totalScore = profile.reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = reviewCount > 0 ? parseFloat((totalScore / reviewCount).toFixed(1)) : 0;

    const { reviews, _count, ...rest } = profile;
    return {
      ...rest,
      reviewCount,
      averageRating,
    };
  }

  async update(userId: string, dto: UpdateCoachProfileDto) {
    const profile = await this.prisma.coachProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Coach profile not found.');
    }

    return this.prisma.coachProfile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.yearsExperience !== undefined && { yearsExperience: dto.yearsExperience }),
        ...(dto.specialties !== undefined && { specialties: dto.specialties }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.locationCity !== undefined && { locationCity: dto.locationCity }),
        ...(dto.hourlyRateVnd !== undefined && { hourlyRateVnd: dto.hourlyRateVnd }),
        ...(dto.paymentAccountName !== undefined && { paymentAccountName: dto.paymentAccountName }),
        ...(dto.paymentAccountNumber !== undefined && { paymentAccountNumber: dto.paymentAccountNumber }),
        ...(dto.paymentBankName !== undefined && { paymentBankName: dto.paymentBankName }),
        ...(dto.paymentQrUrl !== undefined && { paymentQrUrl: dto.paymentQrUrl }),
      },
      include: { certifications: true },
    });
  }

  async publish(userId: string) {
    const profile = await this.prisma.coachProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Coach profile not found.');
    }
    if (profile.status === 'ACTIVE') {
      throw new BadRequestException('Coach profile is already published.');
    }
    if (profile.status === 'SUSPENDED') {
      throw new BadRequestException('A suspended profile cannot be self-published. Please contact support.');
    }

    return this.prisma.coachProfile.update({
      where: { userId },
      data: { status: 'ACTIVE' },
      include: { certifications: true },
    });
  }

  async listPublic(query: ListCoachesQueryDto) {
    const { city, level, page = 1, limit = 10 } = query;

    const where: any = { status: 'ACTIVE' };
    if (city) where.locationCity = { contains: city, mode: 'insensitive' };
    if (level) where.level = level;

    // Fetch all matching basic criteria to calculate ratings dynamically
    const allProfiles = await this.prisma.coachProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        displayName: true,
        avatarUrl: true,
        level: true,
        yearsExperience: true,
        specialties: true,
        languages: true,
        locationCity: true,
        hourlyRateVnd: true,
        verificationStatus: true,
        createdAt: true,
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } },
      },
    });

    let enrichedProfiles = allProfiles.map((p) => {
      const reviewCount = p._count.reviews;
      const totalScore = p.reviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = reviewCount > 0 ? parseFloat((totalScore / reviewCount).toFixed(1)) : 0;
      
      const { reviews, _count, ...rest } = p;
      return {
        ...rest,
        reviewCount,
        averageRating,
      };
    });

    const total = enrichedProfiles.length;
    const skip = (page - 1) * limit;
    const data = enrichedProfiles.slice(skip, skip + limit);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOnePublic(coachId: string) {
    const profile = await this.prisma.coachProfile.findFirst({
      where: { id: coachId, status: 'ACTIVE' },
      include: {
        certifications: {
          orderBy: { issuedAt: 'desc' },
        },
        _count: { select: { reviews: true } },
        reviews: { select: { rating: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException('Coach not found or not publicly available.');
    }

    const reviewCount = profile._count.reviews;
    const totalScore = profile.reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = reviewCount > 0 ? parseFloat((totalScore / reviewCount).toFixed(1)) : 0;

    const { reviews, _count, ...rest } = profile;
    return {
      ...rest,
      reviewCount,
      averageRating,
    };
  }
}
