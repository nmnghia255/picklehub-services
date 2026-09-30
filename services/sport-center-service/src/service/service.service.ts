import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new service for a sport center (owner only)
   */
  async create(centerId: string, ownerId: string, dto: CreateServiceDto) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    return this.prisma.service.create({
      data: {
        centerId,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
        isActive: true,
      },
    });
  }

  /**
   * Update a service (owner only)
   */
  async update(centerId: string, ownerId: string, serviceId: string, dto: UpdateServiceDto) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    // Verify service belongs to center
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, centerId, deletedAt: null },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Delete a service (owner only)
   */
  async delete(centerId: string, ownerId: string, serviceId: string) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    // Verify service belongs to center
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, centerId, deletedAt: null },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Get all active services for a center (for users/players)
   */
  async findByCenterId(centerId: string) {
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, status: 'ACTIVE', deletedAt: null },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found or not active');
    }

    return this.prisma.service.findMany({
      where: { centerId, isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all services for a center (owner view - includes inactive)
   */
  async findByCenterIdOwner(centerId: string, ownerId: string) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    return this.prisma.service.findMany({
      where: { centerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single service
   */
  async findById(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }
}
