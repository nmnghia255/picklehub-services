import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole, PaymentStatus, Prisma, FavoriteQuantityType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GroupErrors } from '../group/errors/group.errors';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { ListEquipmentQueryDto } from './dto/list-equipment-query.dto';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(private readonly prisma: PrismaService) { }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Resolves membership and asserts the caller is a member of the group. */
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

  /** Asserts the caller is the group OWNER. */
  private async assertOwner(groupId: string, userId: string) {
    const result = await this.assertMembership(groupId, userId);
    if (result.membership.role !== GroupMemberRole.OWNER) {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }
    return result;
  }

  // ─── Fetch a single active equipment item owned by the group ─────────────────

  private async findEquipment(equipmentId: string, groupId: string) {
    const equipment = await this.prisma.groupEquipment.findFirst({
      where: { id: equipmentId, groupId, deletedAt: null },
    });
    if (!equipment) throw new NotFoundException(EquipmentErrors.NOT_FOUND);
    return equipment;
  }

  // #region createEquipment
  /**
   * Creates a new equipment item for the group.
   * OWNER only.
   *
   * Behaviour with createExpense=true:
   *  1. A GroupExpense titled "Mua vật dụng: {name}" is created with totalAmount = purchaseCost.
   *  2. GroupPayment rows are created — one per targeted member — using FIFO credit deduction.
   *  3. The new GroupEquipment record is linked to the expense via expenseId.
   *
   * Split logic (when createExpense=true):
   *  - splitAmongAllMembers=true  → All current members share the cost.
   *  - splitAmongAllMembers=false → Only the userIds in `memberIds` are charged.
   *  - requiredFee per member = floor(purchaseCost / memberCount).
   *  - The remainder (purchaseCost % memberCount) is added to the owner's own payment row.
   */
  async createEquipment(groupId: string, userId: string, dto: CreateEquipmentDto) {
    const { group } = await this.assertOwner(groupId, userId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Optionally create a linked GroupExpense + GroupPayment rows
      let expenseId: string | undefined;

      if (dto.createExpense) {
        // Resolve which members to charge
        let targetMembers: { userId: string; creditBalance: number; id: string }[];

        if (dto.splitAmongAllMembers !== false) {
          // Default: split among ALL members
          targetMembers = await tx.groupMember.findMany({
            where: { groupId },
            select: { userId: true, creditBalance: true, id: true },
          });
        } else {
          // Explicit member list
          if (!dto.memberIds || dto.memberIds.length === 0) {
            throw new BadRequestException(
              'memberIds must not be empty when splitAmongAllMembers is false.',
            );
          }
          targetMembers = await tx.groupMember.findMany({
            where: { groupId, userId: { in: dto.memberIds } },
            select: { userId: true, creditBalance: true, id: true },
          });
          if (targetMembers.length !== dto.memberIds.length) {
            throw new BadRequestException(
              'Some provided memberIds are not members of this group.',
            );
          }
        }

        const memberCount = targetMembers.length;
        if (memberCount === 0) {
          throw new BadRequestException(
            'Cannot split an expense across zero members.',
          );
        }

        const feePerMember = Math.floor(dto.purchaseCost / memberCount);
        const remainder = dto.purchaseCost - feePerMember * memberCount;

        // Create the expense
        const expense = await tx.groupExpense.create({
          data: {
            groupId,
            title: `Mua vật dụng: ${dto.name}`,
            description: dto.description ?? null,
            totalAmount: dto.purchaseCost,
            expenseDate: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
            createdById: userId,
          },
        });
        expenseId = expense.id;

        // Create one GroupPayment per member with FIFO credit deduction
        for (const member of targetMembers) {
          const isOwner = member.userId === userId;
          const required = feePerMember + (isOwner ? remainder : 0);

          const creditDeduction = Math.min(member.creditBalance, required);
          const amountPaid = creditDeduction;
          let status: PaymentStatus = PaymentStatus.UNPAID;
          if (creditDeduction > 0) {
            status =
              creditDeduction >= required
                ? PaymentStatus.PAID
                : PaymentStatus.PARTIALLY_PAID;
          }

          if (creditDeduction > 0) {
            await tx.groupMember.update({
              where: { id: member.id },
              data: { creditBalance: member.creditBalance - creditDeduction },
            });
          }

          await tx.groupPayment.create({
            data: {
              expenseId: expense.id,
              userId: member.userId,
              requiredFee: required,
              amountPaid,
              status,
              paidAt: status === PaymentStatus.PAID ? new Date() : null,
            },
          });
        }
      }

      // 2. Create the GroupEquipment record
      const equipment = await tx.groupEquipment.create({
        data: {
          groupId,
          name: dto.name,
          description: dto.description ?? null,
          quantity: dto.quantity,
          purchaseCost: dto.purchaseCost,
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
          condition: dto.condition ?? 'NEW',
          expenseId: expenseId ?? null,
          createdById: userId,
        },
        include: { expense: true },
      });

      // 3. Increment usageCount on favorite template if same-name exists
      const favorite = await tx.groupEquipmentFavorite.findFirst({
        where: { groupId, name: dto.name },
      });
      if (favorite) {
        await tx.groupEquipmentFavorite.update({
          where: { id: favorite.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      this.logger.log(
        `Equipment "${equipment.name}" created in group ${group.name}` +
        (expenseId ? ` with linked expense ${expenseId}` : ''),
      );

      return {
        message: 'Equipment created successfully',
        data: equipment,
      };
    });
  }
  // #endregion

  // #region listEquipment
  /**
   * Lists all active equipment items in a group.
   * Available to all group MEMBERS.
   *
   * Soft-deleted items (deletedAt IS NOT NULL) are excluded by default.
   * Owners may pass `includeDeleted=true` to see archived items.
   */
  async listEquipment(groupId: string, userId: string, query: ListEquipmentQueryDto) {
    const { membership } = await this.assertMembership(groupId, userId);
    const isOwner = membership.role === GroupMemberRole.OWNER;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    // Only owners can request soft-deleted items
    const showDeleted = isOwner && query.includeDeleted === true;

    const where: Prisma.GroupEquipmentWhereInput = {
      groupId,
      ...(showDeleted ? {} : { deletedAt: null }),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isFavorite !== undefined ? { isFavorite: query.isFavorite } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.groupEquipment.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.groupEquipment.count({ where }),
    ]);

    const data = items;

    return {
      message: 'List equipment successfully',
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
  // #endregion

  // #region getEquipmentById
  /**
   * Returns full detail for a single equipment item.
   * Available to all group MEMBERS.
   *
   * The `expense` block is included, but without the full array of payers to protect privacy.
   * The `myPayment` shortcut is included for the caller to see their own debt.
   */
  async getEquipmentById(equipmentId: string, groupId: string, userId: string) {
    await this.assertMembership(groupId, userId);

    const item = await this.prisma.groupEquipment.findFirst({
      where: { id: equipmentId, groupId, deletedAt: null },
      include: {
        expense: {
          include: {
            payments: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!item) throw new NotFoundException(EquipmentErrors.NOT_FOUND);

    const myPayment = item.expense?.payments?.[0] ?? null;

    // Remove the payments array from the expense object to keep the response clean
    if (item.expense) {
      delete (item.expense as any).payments;
    }

    return {
      message: 'Get equipment details successfully',
      data: {
        ...item,
        myPayment: myPayment
          ? {
            id: myPayment.id,
            requiredFee: myPayment.requiredFee,
            amountPaid: myPayment.amountPaid,
            outstandingFee: Math.max(0, myPayment.requiredFee - myPayment.amountPaid),
            status: myPayment.status,
          }
          : null,
      },
    };
  }
  // #endregion

  // #region updateEquipment
  /**
   * Updates metadata of an equipment item: name, description, quantity, or condition.
   * OWNER only.
   *
   * Intentionally does NOT allow changing purchaseCost or re-splitting the linked expense.
   * If the purchase cost was recorded incorrectly, the owner should use the
   * `PATCH /groups/:groupId/finances/expenses/:expenseId` endpoint directly.
   */
  async updateEquipment(
    equipmentId: string,
    groupId: string,
    userId: string,
    dto: UpdateEquipmentDto,
  ) {
    await this.assertOwner(groupId, userId);
    await this.findEquipment(equipmentId, groupId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật item trong bảng items
      const updated = await tx.groupEquipment.update({
        where: { id: equipmentId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.quantity !== undefined && { quantity: dto.quantity }),
          ...(dto.condition !== undefined && { condition: dto.condition }),
          ...(dto.purchaseCost !== undefined && { purchaseCost: dto.purchaseCost }),
        },
      });

      // 2. Nếu item này đang có isFavorite: true:
      if (updated.isFavorite) {
        // a. Tìm TẤT CẢ item cùng tên (tên mới của item) có isFavorite: true
        const favoritedItems = await tx.groupEquipment.findMany({
          where: {
            groupId,
            name: updated.name,
            isFavorite: true,
            deletedAt: null,
          },
          orderBy: { purchasedAt: 'desc' }, // b. Lấy item MỚI NHẤT
        });

        const latestItem = favoritedItems[0];
        if (latestItem) {
          // c. Cập nhật bảng favorites với thông tin từ item mới nhất đó
          const favorite = await tx.groupEquipmentFavorite.findFirst({
            where: { groupId, name: updated.name },
          });

          if (favorite) {
            await tx.groupEquipmentFavorite.update({
              where: { id: favorite.id },
              data: {
                defaultQuantity: latestItem.quantity,
                defaultQuantityType: FavoriteQuantityType.NUMBER,
                defaultCondition: latestItem.condition,
                defaultCost: latestItem.purchaseCost,
              },
            });
          } else {
            await tx.groupEquipmentFavorite.create({
              data: {
                groupId,
                name: updated.name,
                defaultQuantity: latestItem.quantity,
                defaultQuantityType: FavoriteQuantityType.NUMBER,
                defaultCondition: latestItem.condition,
                defaultCost: latestItem.purchaseCost,
              },
            });
          }
        }
      }

      return {
        message: 'Equipment updated successfully',
        data: updated,
      };
    });
  }

  /**
   * Toggles the favorite status of a physical equipment item.
   * Updates/creates the favorite template record accordingly.
   */
  async toggleFavoriteStatus(
    groupId: string,
    equipmentId: string,
    userId: string,
    isFavorite: boolean,
  ) {
    await this.assertOwner(groupId, userId);
    const item = await this.prisma.groupEquipment.findFirst({
      where: { id: equipmentId, groupId, deletedAt: null },
    });
    if (!item) throw new NotFoundException(EquipmentErrors.NOT_FOUND);

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật isFavorite trên GroupEquipment
      const updatedItem = await tx.groupEquipment.update({
        where: { id: equipmentId },
        data: { isFavorite },
      });

      if (isFavorite) {
        // Tìm bản ghi yêu thích theo name và groupId
        const favorite = await tx.groupEquipmentFavorite.findFirst({
          where: { groupId, name: item.name },
        });

        if (!favorite) {
          // Nếu chưa có → Tạo mới với thông tin từ item
          await tx.groupEquipmentFavorite.create({
            data: {
              groupId,
              name: item.name,
              defaultQuantity: item.quantity,
              defaultQuantityType: FavoriteQuantityType.NUMBER,
              defaultCondition: item.condition,
              defaultCost: item.purchaseCost,
            },
          });
        } else {
          // Nếu đã có → Override (cập nhật) với thông tin từ item mới nhất
          // (Chính là item vừa được chuyển sang favorite = true)
          await tx.groupEquipmentFavorite.update({
            where: { id: favorite.id },
            data: {
              defaultQuantity: item.quantity,
              defaultQuantityType: FavoriteQuantityType.NUMBER,
              defaultCondition: item.condition,
              defaultCost: item.purchaseCost,
            },
          });
        }
      } else {
        // Tìm bản ghi yêu thích theo name
        const favorite = await tx.groupEquipmentFavorite.findFirst({
          where: { groupId, name: item.name },
        });

        if (favorite) {
          // Nếu còn item khác cùng tên đang yêu thích → Cập nhật theo item mới nhất
          const otherFavorited = await tx.groupEquipment.findFirst({
            where: {
              groupId,
              name: item.name,
              isFavorite: true,
              id: { not: equipmentId },
              deletedAt: null,
            },
            orderBy: { purchasedAt: 'desc' }, // mới nhất theo purchasedAt
          });

          if (otherFavorited) {
            await tx.groupEquipmentFavorite.update({
              where: { id: favorite.id },
              data: {
                defaultQuantity: otherFavorited.quantity,
                defaultQuantityType: FavoriteQuantityType.NUMBER,
                defaultCondition: otherFavorited.condition,
                defaultCost: otherFavorited.purchaseCost,
              },
            });
          }
          // Nếu không còn item nào → Giữ nguyên bản ghi (không xóa)
        }
      }

      return {
        message: 'Favorite status updated successfully',
        data: updatedItem,
      };
    });
  }
  // #endregion

  // #region softDeleteEquipment
  /**
   * Soft-deletes an equipment item by setting deletedAt to the current timestamp.
   * OWNER only.
   *
   * The linked GroupExpense and its GroupPayment rows are intentionally preserved
   * so that the financial history remains intact. Members who still owe money for
   * this purchase will continue to appear in the debt ledger.
   *
   * Soft-deleted items are hidden from the default listEquipment response.
   * Owners can still view them by passing `includeDeleted=true`.
   */
  async softDeleteEquipment(equipmentId: string, groupId: string, userId: string) {
    await this.assertOwner(groupId, userId);
    await this.findEquipment(equipmentId, groupId); // ensures it exists and is not already deleted

    await this.prisma.groupEquipment.update({
      where: { id: equipmentId },
      data: { deletedAt: new Date() },
    });

    return {
      message:
        'Equipment soft-deleted successfully. Financial records linked to this item are preserved.',
    };
  }
  // #endregion
}

// ─── Error constants ──────────────────────────────────────────────────────────
export const EquipmentErrors = {
  NOT_FOUND: {
    code: 'EQUIPMENT_NOT_FOUND',
    message: 'Equipment item not found or has been deleted.',
  },
} as const;
