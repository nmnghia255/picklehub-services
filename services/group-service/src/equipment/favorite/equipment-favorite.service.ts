import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { GroupErrors } from '../../group/errors/group.errors';
import { UpsertFavoriteItemDto } from '../dto/upsert-favorite-item.dto';

@Injectable()
export class EquipmentFavoriteService {
  private readonly logger = new Logger(EquipmentFavoriteService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async assertMembership(groupId: string, userId: string) {
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: { userId_groupId: { groupId, userId } },
      }),
    ]);

    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    return { group, membership };
  }

  private async assertOwner(groupId: string, userId: string) {
    const result = await this.assertMembership(groupId, userId);
    if (result.membership.role !== GroupMemberRole.OWNER) {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }
    return result;
  }

  // ─── Service Methods ─────────────────────────────────────────────────────────

  /**
   * Retrieves all favorite equipment templates for the group, sorted by usageCount desc.
   * Available to group MEMBERS.
   */
  async listFavorites(groupId: string, userId: string) {
    await this.assertMembership(groupId, userId);

    const favorites = await this.prisma.groupEquipmentFavorite.findMany({
      where: { groupId, isActive: true },
      orderBy: { usageCount: 'desc' },
    });

    return {
      message: 'Get favorite equipment templates successfully',
      data: favorites,
    };
  }

  /**
   * Manually updates a favorite equipment template details (name, default quantity, condition, cost, etc).
   * OWNER only.
   */
  async updateFavorite(
    favoriteId: string,
    groupId: string,
    userId: string,
    dto: UpsertFavoriteItemDto,
  ) {
    await this.assertOwner(groupId, userId);

    const favorite = await this.prisma.groupEquipmentFavorite.findFirst({
      where: { id: favoriteId, groupId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite equipment template not found.');
    }

    // Check for duplicate name if name is being changed
    if (dto.name && dto.name !== favorite.name) {
      const duplicate = await this.prisma.groupEquipmentFavorite.findFirst({
        where: { groupId, name: dto.name },
      });
      if (duplicate) {
        throw new ConflictException('A favorite equipment item with this name already exists.');
      }
    }

    const updated = await this.prisma.groupEquipmentFavorite.update({
      where: { id: favoriteId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultQuantity !== undefined && { defaultQuantity: dto.defaultQuantity }),
        ...(dto.defaultQuantityType !== undefined && { defaultQuantityType: dto.defaultQuantityType }),
        ...(dto.defaultCondition !== undefined && { defaultCondition: dto.defaultCondition }),
        ...(dto.defaultCost !== undefined && { defaultCost: dto.defaultCost }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Favorite equipment template "${updated.name}" updated by owner ${userId}`);

    return {
      message: 'Favorite equipment template updated successfully',
      data: updated,
    };
  }

  /**
   * Deletes a favorite equipment template from the database.
   * OWNER only.
   */
  async deleteFavorite(favoriteId: string, groupId: string, userId: string) {
    await this.assertOwner(groupId, userId);

    const favorite = await this.prisma.groupEquipmentFavorite.findFirst({
      where: { id: favoriteId, groupId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite equipment template not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupEquipmentFavorite.delete({
        where: { id: favoriteId },
      });

      await tx.groupEquipment.updateMany({
        where: {
          groupId,
          name: favorite.name,
          deletedAt: null,
          isFavorite: true,
        },
        data: { isFavorite: false },
      });
    });

    this.logger.log(
      `Favorite equipment template "${favorite.name}" deleted and corresponding equipment items unmarked by owner ${userId}`,
    );

    return {
      message: 'Favorite equipment template deleted successfully',
    };
  }
}
