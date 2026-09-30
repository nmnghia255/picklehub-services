import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new product for a sport center (owner only)
   */
  async create(centerId: string, ownerId: string, dto: CreateProductDto) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    return this.prisma.product.create({
      data: {
        centerId,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
        stock: dto.stock ?? 0,
        isActive: true,
      },
    });
  }

  /**
   * Update a product (owner only)
   */
  async update(centerId: string, ownerId: string, productId: string, dto: UpdateProductDto) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    // Verify product belongs to center
    const product = await this.prisma.product.findFirst({
      where: { id: productId, centerId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        type: dto.type,
        price: dto.price,
        unit: dto.unit,
        stock: dto.stock,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Delete a product (owner only)
   */
  async delete(centerId: string, ownerId: string, productId: string) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    // Verify product belongs to center
    const product = await this.prisma.product.findFirst({
      where: { id: productId, centerId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Get all active products for a center (for users/players)
   */
  async findByCenterId(centerId: string) {
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, status: 'ACTIVE', deletedAt: null },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found or not active');
    }

    return this.prisma.product.findMany({
      where: { centerId, isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all products for a center (owner view - includes inactive)
   */
  async findByCenterIdOwner(centerId: string, ownerId: string) {
    // Verify center exists and belongs to the owner
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, ownerId, deletedAt: null },
    });

    if (!center) {
      throw new UnauthorizedException('Center not found or access denied');
    }

    return this.prisma.product.findMany({
      where: { centerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single product
   */
  async findById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
