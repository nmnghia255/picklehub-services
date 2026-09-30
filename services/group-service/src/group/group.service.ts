import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GroupMemberRole, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { ListGroupsQueryDto } from './dto/list-groups.query.dto';
import { ListMyGroupsQueryDto } from './dto/list-my-groups.query.dto';
import { ListMembersQueryDto } from './dto/list-members.query.dto';
import {
  AdminGroupListItem,
  GroupRoleResponse,
  MyGroupListItem,
  PaginatedResult,
} from './dto/list-groups.response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupErrors } from './errors/group.errors';
import axios from 'axios';
import { NotificationService } from '../notification/notification.service';
import { ChatClient } from '../clients/chat.client';

type GroupStatusFilter = 'ACTIVE' | 'GRACE_PERIOD' | 'FROZEN' | 'ARCHIVED';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);
  private readonly internalHeader = 'x-internal-token';
  private readonly maxPageSize = 100;
  private readonly defaultPageSize = 10;
  private readonly groupStatusValues: readonly GroupStatusFilter[] = [
    'ACTIVE',
    'GRACE_PERIOD',
    'FROZEN',
    'ARCHIVED',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly chatClient: ChatClient,
  ) { }

  private get authServiceUrl() {
    return process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001';
  }

  private get authInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private get subscriptionServiceUrl() {
    return process.env.SUBSCRIPTION_SERVICE_URL ?? 'http://subscription-service:8012';
  }

  private get subscriptionInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private get internalHeaders() {
    return { [this.internalHeader]: this.authInternalToken };
  }

  private toGroupRoleResponse(role: GroupMemberRole): GroupRoleResponse {
    return role.toLowerCase() as GroupRoleResponse;
  }

  private getGroupAvatar(group: object): string | null {
    const avatar = (group as Record<string, unknown>).avatarUrl;
    return typeof avatar === 'string' ? avatar : null;
  }

  private getGroupMaxMembers(group: { maxMembers: number | null }): number {
    return group.maxMembers ?? 50;
  }

  private normalizePagination(query: ListGroupsQueryDto): {
    page: number;
    limit: number;
    skip: number;
  } {
    const page = Number.parseInt(String(query.page ?? '1'), 10);
    const limit = Number.parseInt(String(query.limit ?? this.defaultPageSize), 10);

    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException('page must be an integer greater than or equal to 1');
    }

    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException('limit must be an integer greater than or equal to 1');
    }

    const normalizedLimit = Math.min(limit, this.maxPageSize);

    return {
      page,
      limit: normalizedLimit,
      skip: (page - 1) * normalizedLimit,
    };
  }

  private normalizeRoleFilter(role: string | undefined): GroupMemberRole | undefined {
    if (!role) return undefined;

    const normalizedRole = role.toUpperCase();
    if (!Object.values(GroupMemberRole).includes(normalizedRole as GroupMemberRole)) {
      throw new BadRequestException('role must be one of OWNER, MEMBER');
    }

    return normalizedRole as GroupMemberRole;
  }

  private normalizeStatusFilter(status: string | undefined): GroupStatusFilter | undefined {
    if (!status) return undefined;

    const normalizedStatus = status.toUpperCase() as GroupStatusFilter;
    if (!this.groupStatusValues.includes(normalizedStatus)) {
      throw new BadRequestException(
        'status must be one of ACTIVE, GRACE_PERIOD, FROZEN, ARCHIVED',
      );
    }

    return normalizedStatus;
  }

  async getUserById(userId: string): Promise<{ id: string; name: string | null; email: string; role: string } | null> {
    if (!userId) return null;
    try {
      const res = await axios.get(`${this.authServiceUrl}/api/auth/internal/users/${userId}`, {
        headers: this.internalHeaders,
        validateStatus: () => true,
      });

      if (res.status === 404) return null;
      if (res.status >= 400) {
        throw new ForbiddenException('Cannot verify caller profile');
      }

      return res.data;
    } catch (error) {
      this.logger.error(`Failed to fetch user ${userId} from auth-service`, error);
      return null;
    }
  }

  async getUsersMapByIds(userIds: string[]): Promise<Map<string, { id: string; name: string | null; email: string; role: string; avatarUrl?: string | null }>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();

    try {
      const res = await axios.post(
        `${this.authServiceUrl}/api/auth/internal/users/batch`,
        { userIds: uniqueIds },
        { headers: this.internalHeaders },
      );

      const users: Array<{ id: string; name: string | null; email: string; role: string; avatarUrl?: string | null }> = Array.isArray(res.data) ? res.data : [];
      return new Map(users.map((u) => [u.id, u]));
    } catch (error) {
      this.logger.error(`Failed to fetch users batch from auth-service`, error);
      return new Map();
    }
  }

  async createGroup(
    userId: string,
    dto: CreateGroupDto,
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    createdBy: string;
    createdAt: Date;
    role: string;
  }> {
    const { group } = await this.prisma.$transaction(async (tx) => {
      const ownedGroupsCount = await tx.group.count({
        where: {
          createdById: userId,
          status: { not: 'ARCHIVED' },
        },
      });
      if (ownedGroupsCount >= 5) {
        throw new BadRequestException('You cannot own more than 5 groups.');
      }

      const data: Prisma.GroupUncheckedCreateInput = {
        name: dto.name,
        description: dto.description ?? null,
        maxMembers: 50,
        createdById: userId,
      };

      if (dto.avatarUrl !== undefined) {
        (data as Record<string, unknown>).avatarUrl = dto.avatarUrl;
      }

      const group = await tx.group.create({
        data,
      }).catch((err) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(
            `You already have a group named "${dto.name}".`,
          );
        }
        throw err;
      });

      await tx.groupMember.create({
        data: {
          userId,
          groupId: group.id,
          role: GroupMemberRole.OWNER,
        },
      });

      return { group };
    });

    this.logger.log(`Group "${group.name}" created by userId=${userId}`);

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: this.getGroupAvatar(group),
      createdBy: userId,
      createdAt: group.createdAt,
      role: GroupMemberRole.OWNER,
    };
  }

  async getAllGroupsForAdmin(
    query: ListGroupsQueryDto,
  ): Promise<PaginatedResult<AdminGroupListItem>> {
    const { page, limit, skip } = this.normalizePagination(query);

    const where: Prisma.GroupWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, groups] = await this.prisma.$transaction([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { members: true } } },
      }),
    ]);

    return {
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        avatarUrl: this.getGroupAvatar(g),
        maxMembers: this.getGroupMaxMembers(g),
        memberCount: g._count.members,
        role: null,
        createdAt: g.createdAt,
        status: g.status
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getMyGroups(
    callerId: string,
    query: ListMyGroupsQueryDto,
  ): Promise<PaginatedResult<MyGroupListItem>> {
    if (!callerId) {
      throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    }

    const { page, limit, skip } = this.normalizePagination(query);
    const role = this.normalizeRoleFilter(query.role);
    const status = this.normalizeStatusFilter(query.status);

    const groupWhere: Prisma.GroupWhereInput = {};
    if (status) {
      groupWhere.status = status;
    }
    if (query.search) {
      groupWhere.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const where: Prisma.GroupMemberWhereInput = {
      userId: callerId,
      ...(role ? { role } : {}),
      group: groupWhere,
    };

    const [total, memberships] = await this.prisma.$transaction([
      this.prisma.groupMember.count({ where }),
      this.prisma.groupMember.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
        include: {
          group: {
            include: { _count: { select: { members: true } } },
          },
        },
      }),
    ]);

    return {
      data: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        description: m.group.description,
        avatarUrl: this.getGroupAvatar(m.group),
        maxMembers: this.getGroupMaxMembers(m.group),
        memberCount: m.group._count.members,
        role: this.toGroupRoleResponse(m.role),
        status: m.group.status,
        createdAt: m.group.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getGroupsByUserId(
    userId: string,
    query: ListMyGroupsQueryDto,
  ): Promise<PaginatedResult<MyGroupListItem>> {
    if (!userId) {
      throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    }

    const { page, limit, skip } = this.normalizePagination(query);
    const role = this.normalizeRoleFilter(query.role);
    const status = this.normalizeStatusFilter(query.status);

    const groupWhere: Prisma.GroupWhereInput = {};
    if (status) {
      groupWhere.status = status;
    }
    if (query.search) {
      groupWhere.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const where: Prisma.GroupMemberWhereInput = {
      userId,
      ...(role ? { role } : {}),
      group: groupWhere,
    };

    const [total, memberships] = await this.prisma.$transaction([
      this.prisma.groupMember.count({ where }),
      this.prisma.groupMember.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
        include: {
          group: {
            include: { _count: { select: { members: true } } },
          },
        },
      }),
    ]);

    return {
      data: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        description: m.group.description,
        avatarUrl: this.getGroupAvatar(m.group),
        maxMembers: this.getGroupMaxMembers(m.group),
        memberCount: m.group._count.members,
        role: this.toGroupRoleResponse(m.role),
        status: m.group.status,
        createdAt: m.group.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async getOwnerSubscription(ownerUserId: string) {
    try {
      const res = await axios.get(`${this.subscriptionServiceUrl}/internal/subscriptions/verify`, {
        params: {
          userId: ownerUserId,
          planType: 'GROUP_OWNER',
        },
        headers: {
          'x-internal-token': this.subscriptionInternalToken,
        },
      });
      return {
        hasAccess: res.data?.hasAccess ?? false,
        planType: res.data?.planType ?? 'GROUP_OWNER',
        subscriptionId: res.data?.subscriptionId ?? null,
        expiresAt: res.data?.expiresAt ?? null,
      };
    } catch (err) {
      this.logger.error(`Failed to fetch subscription for group owner ${ownerUserId}`, err);
      return {
        hasAccess: false,
        planType: 'GROUP_OWNER',
        subscriptionId: null,
        expiresAt: null,
      };
    }
  }

  async getGroupById(callerId: string, groupId: string): Promise<{
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    maxMembers: number;
    memberCount: number;
    status: GroupStatusFilter;
    role: string | null;
    subscription: {
      hasAccess: boolean;
      planType: string;
      subscriptionId: string | null;
      expiresAt: Date | null;
    } | null;
    createdAt: Date;
  }> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const membership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });

    if (!membership && caller.role !== 'ADMIN') {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);
    }

    const subscription = await this.getOwnerSubscription(group.createdById);

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: this.getGroupAvatar(group),
      maxMembers: this.getGroupMaxMembers(group),
      memberCount: group._count.members,
      status: group.status,
      role: membership?.role.toLowerCase() ?? null,
      subscription,
      createdAt: group.createdAt,
    };
  }

  async getGroupMembers(
    callerId: string,
    groupId: string,
    query: ListMembersQueryDto,
  ): Promise<PaginatedResult<{
    userId: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
    joinedAt: Date;
    guestCount: number;
  }>> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const membership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });
    if (!membership && caller.role !== 'ADMIN') {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    const userIds = members.map((m) => m.userId);
    const usersMap = await this.getUsersMapByIds(userIds);

    let filteredMembers = members;
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredMembers = members.filter((m) => {
        const user = usersMap.get(m.userId);
        if (!user) return false;
        return (
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
        );
      });
    }

    const { page, limit, skip } = this.normalizePagination(query);
    const paginatedMembers = filteredMembers.slice(skip, skip + limit);

    let guestCountsMap = new Map<string, number>();
    if (query.activityId) {
      const attendances = await this.prisma.sessionAttendance.findMany({
        where: {
          activityId: query.activityId,
          memberId: { in: paginatedMembers.map((m) => m.id) },
          guestStatus: 'APPROVED',
        },
        select: {
          memberId: true,
          guestCount: true,
        },
      });
      for (const att of attendances) {
        guestCountsMap.set(att.memberId, att.guestCount);
      }
    }

    const data = paginatedMembers.map((m) => ({
      userId: m.userId,
      name: usersMap.get(m.userId)?.name ?? null,
      email: usersMap.get(m.userId)?.email ?? '',
      avatarUrl: usersMap.get(m.userId)?.avatarUrl ?? null,
      role: m.role.toLowerCase(),
      joinedAt: m.joinedAt,
      guestCount: guestCountsMap.get(m.id) ?? 0,
    }));

    const total = filteredMembers.length;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async updateGroupInfo(
    callerId: string,
    groupId: string,
    dto: UpdateGroupDto,
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    maxMembers: number;
    memberCount: number;
    status: GroupStatusFilter;
    role: string | null;
    createdAt: Date;
  }> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const callerMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });

    const isGroupOwner = callerMembership?.role === GroupMemberRole.OWNER;
    if (!isGroupOwner) {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }

    if (group.status !== 'ACTIVE' && group.status !== 'GRACE_PERIOD') {
      throw new ForbiddenException(GroupErrors.GROUP_STATUS_NOT_EDITABLE);
    }

    const data: Prisma.GroupUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.avatarUrl !== undefined) {
      (data as Record<string, unknown>).avatarUrl = dto.avatarUrl;
    }
    if (dto.maxMembers !== undefined) data.maxMembers = dto.maxMembers;

    if (Object.keys(data).length === 0) {
      return this.getGroupById(callerId, groupId);
    }

    let updatedGroup: {
      id: string;
      name: string;
      description: string | null;
      maxMembers: number | null;
      status: GroupStatusFilter;
      createdAt: Date;
      _count: { members: number };
    };

    try {
      updatedGroup = await this.prisma.group.update({
        where: { id: groupId },
        data,
        include: { _count: { select: { members: true } } },
      }) as typeof updatedGroup;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`You already have a group named "${dto.name}".`);
      }
      throw err;
    }

    this.logger.log(`Group updated — groupId=${groupId} by callerId=${callerId}`);
    return {
      id: updatedGroup.id,
      name: updatedGroup.name,
      description: updatedGroup.description,
      avatarUrl: this.getGroupAvatar(updatedGroup),
      maxMembers: this.getGroupMaxMembers(updatedGroup),
      memberCount: updatedGroup._count.members,
      status: updatedGroup.status,
      role: callerMembership?.role.toLowerCase() ?? null,
      createdAt: updatedGroup.createdAt,
    };
  }

  async transferOwnership(
    callerId: string,
    groupId: string,
    targetMemberId: string,
  ): Promise<{ groupId: string; newOwnerId: string }> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    // Validate group status is not ARCHIVED
    if (group.status === 'ARCHIVED') {
      throw new ForbiddenException('Action forbidden: This group has been archived');
    }

    const callerMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });
    const isGroupOwner = callerMembership?.role === GroupMemberRole.OWNER;
    if (!isGroupOwner) {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }

    const targetMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetMemberId, groupId } },
    });
    if (!targetMembership) throw new NotFoundException(GroupErrors.GROUP_MEMBER_NOT_FOUND);

    if (targetMembership.role === GroupMemberRole.OWNER) {
      throw new BadRequestException('Target member is already the owner of this group.');
    }

    // Call subscription-service to verify target member has GROUP_OWNER plan
    const subscriptionServiceUrl =
      this.configService.get<string>('SUBSCRIPTION_SERVICE_URL') ??
      'http://subscription-service:8012';
    const subscriptionInternalToken =
      this.configService.get<string>('SERVICE_INTERNAL_TOKEN') ||
      process.env.SERVICE_INTERNAL_TOKEN ||
      '';

    try {
      const response = await axios.get(
        `${subscriptionServiceUrl}/internal/subscriptions/verify`,
        {
          params: {
            userId: targetMemberId,
            planType: 'GROUP_OWNER',
          },
          headers: {
            'x-internal-token': subscriptionInternalToken,
          },
          validateStatus: () => true,
        },
      );

      if (response.status !== 200 || !response.data?.hasAccess) {
        throw new ForbiddenException(
          'Target member must have an active GROUP_OWNER subscription to receive ownership.',
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(
        'Failed to verify target member subscription. Please try again later.',
      );
    }

    // Check target member's owned groups count (max 5)
    const ownedGroupsCount = await this.prisma.group.count({
      where: {
        createdById: targetMemberId,
        status: { not: 'ARCHIVED' },
      },
    });
    if (ownedGroupsCount >= 5) {
      throw new BadRequestException('The target member already owns the maximum limit of 5 groups.');
    }

    // Determine the next status for the group. If the group was FROZEN, reactivate it to ACTIVE.
    const nextStatus = group.status === 'FROZEN' ? 'ACTIVE' : group.status;

    await this.prisma.$transaction([
      this.prisma.groupMember.update({
        where: { userId_groupId: { userId: callerId, groupId } },
        data: { role: GroupMemberRole.MEMBER },
      }),
      this.prisma.groupMember.update({
        where: { userId_groupId: { userId: targetMemberId, groupId } },
        data: { role: GroupMemberRole.OWNER },
      }),
      this.prisma.group.update({
        where: { id: groupId },
        data: {
          createdById: targetMemberId,
          status: nextStatus,
        },
      }),
    ]);

    this.logger.log(`Ownership transferred — groupId=${groupId} newOwnerId=${targetMemberId} by previousOwnerId=${callerId}`);
    return { groupId, newOwnerId: targetMemberId };
  }

  async archiveGroup(
    callerId: string,
    groupId: string,
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    maxMembers: number;
    memberCount: number;
    status: GroupStatusFilter;
    role: string | null;
    createdAt: Date;
  }> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const callerMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });

    const isGroupOwner = callerMembership?.role === GroupMemberRole.OWNER;
    if (!isGroupOwner) {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }

    const archivedGroup =
      group.status === 'ARCHIVED'
        ? group
        : await this.prisma.group.update({
          where: { id: groupId },
          data: { status: 'ARCHIVED' },
          include: { _count: { select: { members: true } } },
        });

    this.logger.log(`Group archived — groupId=${groupId} by callerId=${callerId}`);

    return {
      id: archivedGroup.id,
      name: archivedGroup.name,
      description: archivedGroup.description,
      avatarUrl: this.getGroupAvatar(archivedGroup),
      maxMembers: this.getGroupMaxMembers(archivedGroup),
      memberCount: archivedGroup._count.members,
      status: archivedGroup.status,
      role: callerMembership?.role.toLowerCase() ?? null,
      createdAt: archivedGroup.createdAt,
    };
  }

  async restoreGroup(
    callerId: string,
    groupId: string,
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    maxMembers: number;
    memberCount: number;
    status: GroupStatusFilter;
    role: string | null;
    createdAt: Date;
  }> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const callerMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });

    const isGroupOwner = callerMembership?.role === GroupMemberRole.OWNER;
    if (!isGroupOwner) {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }

    if (group.status !== 'ARCHIVED') {
      throw new BadRequestException('Group is not archived.');
    }

    const ownedGroupsCount = await this.prisma.group.count({
      where: {
        createdById: group.createdById,
        status: { not: 'ARCHIVED' },
      },
    });
    if (ownedGroupsCount >= 5) {
      throw new BadRequestException('You cannot own more than 5 groups.');
    }

    const restoredGroup = await this.prisma.group.update({
      where: { id: groupId },
      data: { status: 'ACTIVE' },
      include: { _count: { select: { members: true } } },
    });

    this.logger.log(`Group restored — groupId=${groupId} by callerId=${callerId}`);

    return {
      id: restoredGroup.id,
      name: restoredGroup.name,
      description: restoredGroup.description,
      avatarUrl: this.getGroupAvatar(restoredGroup),
      maxMembers: this.getGroupMaxMembers(restoredGroup),
      memberCount: restoredGroup._count.members,
      status: restoredGroup.status,
      role: callerMembership?.role.toLowerCase() ?? null,
      createdAt: restoredGroup.createdAt,
    };
  }

  async leaveGroup(
    callerId: string,
    groupId: string,
  ): Promise<{ message: string }> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const callerMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });
    if (!callerMembership) throw new NotFoundException(GroupErrors.GROUP_MEMBER_NOT_FOUND);

    if (callerMembership.role === GroupMemberRole.OWNER) {
      const ownerCount = await this.prisma.groupMember.count({
        where: { groupId, role: GroupMemberRole.OWNER },
      });
      if (ownerCount <= 1) throw new ForbiddenException(GroupErrors.GROUP_OWNER_CANNOT_LEAVE);
    }

    await this.prisma.groupMember.delete({
      where: { userId_groupId: { userId: callerId, groupId } },
    });

    this.logger.log(`Member left group — userId=${callerId} groupId=${groupId}`);

    // Fire-and-forget: sync remaining members to chat-service
    const remainingMembers = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    this.chatClient.syncGroupChat(groupId, remainingMembers.map((m) => m.userId));

    return { message: 'You have left the group.' };
  }

  async kickMember(
    callerId: string,
    groupId: string,
    targetUserId: string,
  ): Promise<{ message: string }> {
    const caller = await this.getUserById(callerId);
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const targetMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!targetMembership) throw new NotFoundException(GroupErrors.GROUP_MEMBER_NOT_FOUND);

    const callerMembership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });
    const isGroupOwner = callerMembership?.role === GroupMemberRole.OWNER;
    const isPlatformAdmin = caller.role === 'ADMIN';

    if (!isPlatformAdmin && !isGroupOwner) {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }

    if (!isPlatformAdmin) {
      if (targetMembership.role === GroupMemberRole.OWNER) {
        throw new ForbiddenException(GroupErrors.GROUP_CANNOT_KICK_OWNER);
      }
    }

    await this.prisma.groupMember.delete({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });

    this.logger.log(`Member kicked — userId=${targetUserId} groupId=${groupId} by callerId=${callerId}`);

    // Fire-and-forget: sync remaining members to chat-service
    const remainingMembers = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    this.chatClient.syncGroupChat(groupId, remainingMembers.map((m) => m.userId));

    return { message: 'Member removed.' };
  }

  // For sending group notifications
  async sendGroupNotification(
    callerId: string,
    groupId: string,
    dto: { title: string; message: string },
  ): Promise<{ message: string }> {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);

    // send notification to all group members
    await this.notificationService.sendInAppNotification(userIds, dto.title, dto.message);

    // send notification to group feeds
    await this.notificationService.sendGroupFeedNotification(groupId, dto.title, dto.message);

    return { message: 'Notification sent successfully.' };
  }

  // For sending app notifications
}
