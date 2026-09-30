import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { GroupErrors } from '../../group/errors/group.errors';
import { CreateUsageLogDto } from './dto/create-usage-log.dto';
import { ListUsageLogQueryDto, UsageLogSortOrder } from './dto/list-usage-log-query.dto';

@Injectable()
export class EquipmentUsageService {
  private readonly logger = new Logger(EquipmentUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async assertOwner(groupId: string, userId: string) {
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: { userId_groupId: { groupId, userId } },
      }),
    ]);
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);
    if (membership.role !== GroupMemberRole.OWNER)
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    return { group, membership };
  }

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

  /** Resolves the equipment item. Throws 404 if not found, deleted, or not in the group. */
  private async resolveEquipment(equipmentId: string, groupId: string) {
    const equipment = await this.prisma.groupEquipment.findFirst({
      where: { id: equipmentId, groupId, deletedAt: null },
    });
    if (!equipment) {
      throw new NotFoundException({
        code: 'EQUIPMENT_NOT_FOUND',
        message: 'Equipment item not found or has been deleted.',
      });
    }
    return equipment;
  }

  // #region logUsage
  /**
   * Appends a new usage log entry for an equipment item.
   * OWNER only.
   *
   * Usage logs are append-only — there is no update or delete.
   * If the owner made a mistake (e.g. wrong quantity), they should add a
   * corrective entry with a note explaining the adjustment.
   *
   * `usedAt` defaults to now but can be backdated (e.g. the owner forgot to log
   * yesterday's session). It cannot be set to a future date.
   */
  async logUsage(equipmentId: string, groupId: string, userId: string, dto: CreateUsageLogDto) {
    await this.assertOwner(groupId, userId);
    const equipment = await this.resolveEquipment(equipmentId, groupId);

    const usedAt = dto.usedAt ? new Date(dto.usedAt) : new Date();

    if (usedAt > new Date()) {
      throw new BadRequestException('usedAt cannot be a future date.');
    }

    const log = await this.prisma.groupEquipmentUsageLog.create({
      data: {
        groupId,
        equipmentId,
        quantityUsed: dto.quantityUsed,
        note: dto.note ?? null,
        usedAt,
        loggedById: userId,
      },
    });

    this.logger.log(
      `Usage log created: ${dto.quantityUsed} unit(s) of "${equipment.name}" logged by ${userId}`,
    );

    return {
      message: 'Usage logged successfully',
      data: log,
    };
  }
  // #endregion

  // #region listUsageLogs
  /**
   * Returns a paginated list of usage logs for a single equipment item.
   * Available to all group MEMBERS.
   *
   * Filters:
   *  - fromDate / toDate: narrow down by usedAt date range
   *  - sortOrder: desc (newest first, default) or asc (oldest first)
   */
  async listUsageLogs(
    equipmentId: string,
    groupId: string,
    userId: string,
    query: ListUsageLogQueryDto,
  ) {
    await this.assertMembership(groupId, userId);
    await this.resolveEquipment(equipmentId, groupId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const sortOrder = query.sortOrder ?? UsageLogSortOrder.DESC;

    // Build date range filter
    const usedAtFilter: Prisma.GroupEquipmentUsageLogWhereInput['usedAt'] = {};
    if (query.fromDate) {
      usedAtFilter.gte = new Date(query.fromDate);
    }
    if (query.toDate) {
      // Include the full toDate day by going to end-of-day
      const toDate = new Date(query.toDate);
      toDate.setHours(23, 59, 59, 999);
      usedAtFilter.lte = toDate;
    }

    const where: Prisma.GroupEquipmentUsageLogWhereInput = {
      equipmentId,
      groupId,
      ...(Object.keys(usedAtFilter).length > 0 ? { usedAt: usedAtFilter } : {}),
    };

    // Run pagination query
    const [logs, total] = await Promise.all([
      this.prisma.groupEquipmentUsageLog.findMany({
        where,
        orderBy: { usedAt: sortOrder },
        skip: offset,
        take: limit,
      }),
      this.prisma.groupEquipmentUsageLog.count({ where }),
    ]);

    return {
      message: 'List usage logs successfully',
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
  // #endregion
}
