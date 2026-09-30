import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendQueryDto, SortOrder } from './dto/friend-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { FriendshipStatus } from './dto/friend-responses.dto';
import axios from 'axios';


export const FriendErrors = {
  CANNOT_ADD_SELF: 'You cannot send a friend request to yourself.',
  REQUEST_ALREADY_EXISTS:
    'A friend request already exists between these users.',
  ALREADY_FRIENDS: 'You are already friends with this user.',
  REQUEST_NOT_FOUND: 'Friend request not found.',
  FRIENDSHIP_NOT_FOUND: 'Friendship not found.',
  NOT_RECEIVER: 'Only the receiver can accept or reject this request.',
  NOT_SENDER: 'Only the sender can cancel this request.',
  REQUEST_NOT_PENDING: 'This friend request is no longer pending.',
} as const;

type UserProfile = { id: string; name: string | null; email: string; role: string };

@Injectable()
export class FriendService {
  private readonly logger = new Logger(FriendService.name);
  private readonly maxPageSize = 100;
  private readonly defaultPageSize = 10;
  private readonly internalHeader = 'x-internal-token';

  constructor(private readonly prisma: PrismaService) { }

  // ─────────────────────────────────────────
  //  Auth-service helpers
  // ─────────────────────────────────────────

  private get authServiceUrl() {
    return process.env.AUTH_SERVICE_URL ?? 'http://localhost:8001';
  }

  private get authInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private get internalHeaders() {
    return { [this.internalHeader]: this.authInternalToken };
  }

  /** Fetch a single user profile from auth-service. Returns null if not found. */
  private async getUserById(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
    const res = await axios.get(
      `${this.authServiceUrl}/api/auth/internal/users/${userId}`,
      { headers: this.internalHeaders, validateStatus: () => true },
    );
    if (res.status === 404) return null;
    if (res.status >= 400) {
      this.logger.warn(`auth-service returned ${res.status} for userId=${userId}`);
      return null;
    }
    return res.data as UserProfile;
  }

  /** Fetch multiple user profiles from auth-service and return as a keyed Map. */
  private async getUsersMapByIds(
    userIds: string[],
  ): Promise<Map<string, UserProfile>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();

    const res = await axios.post(
      `${this.authServiceUrl}/api/auth/internal/users/batch`,
      { userIds: uniqueIds },
      { headers: this.internalHeaders },
    );

    const users: UserProfile[] = Array.isArray(res.data) ? res.data : [];
    return new Map(users.map((u) => [u.id, u]));
  }

  /**
   * Search users globally by name or email via auth-service.
   * Auth-service exposes GET /api/auth/internal/users?q=&page=&limit=
   */
  private async searchUsersFromAuth(
    q: string,
    page: number,
    limit: number,
  ): Promise<{ data: UserProfile[]; total: number }> {
    const res = await axios.get(
      `${this.authServiceUrl}/api/auth/internal/users`,
      {
        params: { q, page, limit },
        headers: this.internalHeaders,
        validateStatus: () => true,
      },
    );
    if (res.status >= 400) return { data: [], total: 0 };
    // Support both plain array and paginated { data, meta } shapes
    if (Array.isArray(res.data)) {
      return { data: res.data as UserProfile[], total: (res.data as UserProfile[]).length };
    }
    const body = res.data as { data?: UserProfile[]; meta?: { total?: number } };
    return {
      data: body.data ?? [],
      total: body.meta?.total ?? (body.data?.length ?? 0),
    };
  }

  // ─────────────────────────────────────────
  //  Pagination helper
  // ─────────────────────────────────────────

  private normalizePagination(query: FriendQueryDto): {
    page: number;
    limit: number;
    skip: number;
    sortOrder: SortOrder;
  } {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(
      Math.max(1, Number(query.limit ?? this.defaultPageSize)),
      this.maxPageSize,
    );
    const sortOrder = query.sortOrder ?? SortOrder.DESC;

    return { page, limit, skip: (page - 1) * limit, sortOrder };
  }

  private buildMeta(total: number, page: number, limit: number) {
    return {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────
  //  Mutual friends helper
  // ─────────────────────────────────────────

  /**
   * Returns the number of users who are friends with BOTH callerId AND targetId.
   * Uses a raw aggregation-style query via Prisma's two-step set intersection.
   */
  async countMutualFriends(
    callerId: string,
    targetId: string,
  ): Promise<number> {
    // Fetch the friend-id sets for both users in parallel
    const [callerFriends, targetFriends] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { userId: callerId },
        select: { friendId: true },
      }),
      this.prisma.friendship.findMany({
        where: { userId: targetId },
        select: { friendId: true },
      }),
    ]);

    const callerSet = new Set(callerFriends.map((f) => f.friendId));
    const mutual = targetFriends.filter((f) => callerSet.has(f.friendId));
    return mutual.length;
  }

  /**
   * Batch-check relationship status for a list of target users relative to callerId.
   */
  private async getFriendshipStatuses(
    callerId: string,
    targetIds: string[],
  ): Promise<Map<string, FriendshipStatus>> {
    const statuses = new Map<string, FriendshipStatus>();
    if (targetIds.length === 0) return statuses;

    // 1. Fetch friendships
    const friendships = await this.prisma.friendship.findMany({
      where: { userId: callerId, friendId: { in: targetIds } },
    });
    const friendIds = new Set(friendships.map((f) => f.friendId));

    // 2. Fetch pending requests
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        OR: [
          { senderId: callerId, receiverId: { in: targetIds }, status: 'PENDING' },
          { senderId: { in: targetIds }, receiverId: callerId, status: 'PENDING' },
        ],
      },
    });

    for (const targetId of targetIds) {
      if (friendIds.has(targetId)) {
        statuses.set(targetId, FriendshipStatus.FRIEND);
        continue;
      }

      const outgoing = requests.find((r) => r.senderId === callerId && r.receiverId === targetId);
      if (outgoing) {
        statuses.set(targetId, FriendshipStatus.REQUEST_SENT);
        continue;
      }

      const incoming = requests.find((r) => r.senderId === targetId && r.receiverId === callerId);
      if (incoming) {
        statuses.set(targetId, FriendshipStatus.REQUEST_RECEIVED);
        continue;
      }

      statuses.set(targetId, FriendshipStatus.NONE);
    }

    return statuses;
  }


  // ─────────────────────────────────────────
  //  Friend Requests
  // ─────────────────────────────────────────

  async sendRequest(senderId: string, dto: SendFriendRequestDto) {
    const { receiverId } = dto;

    if (senderId === receiverId) {
      throw new BadRequestException(FriendErrors.CANNOT_ADD_SELF);
    }

    // Check existing friendship
    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: senderId, friendId: receiverId },
          { userId: receiverId, friendId: senderId },
        ],
      },
    });
    if (existingFriendship) {
      throw new ConflictException(FriendErrors.ALREADY_FRIENDS);
    }

    // Check for an existing pending request in either direction
    const existingRequest = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
        status: 'PENDING',
      },
    });
    if (existingRequest) {
      throw new ConflictException(FriendErrors.REQUEST_ALREADY_EXISTS);
    }

    // Because of @@unique([senderId, receiverId]), we must recycle an existing 
    // past request (e.g. REJECTED or CANCELLED) if one exists in this exact direction.
    const existingPastRequest = await this.prisma.friendRequest.findUnique({
      where: {
        friend_requests_sender_receiver_uidx: {
          senderId,
          receiverId,
        },
      },
    });

    let request;
    if (existingPastRequest) {
      request = await this.prisma.friendRequest.update({
        where: { id: existingPastRequest.id },
        data: { status: 'PENDING' },
      });
    } else {
      request = await this.prisma.friendRequest.create({
        data: { senderId, receiverId, status: 'PENDING' },
      });
    }

    this.logger.log(
      `Friend request sent — senderId=${senderId} receiverId=${receiverId}`,
    );
    return request;
  }

  async acceptRequest(callerId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException(FriendErrors.REQUEST_NOT_FOUND);
    if (request.receiverId !== callerId)
      throw new ForbiddenException(FriendErrors.NOT_RECEIVER);
    if (request.status !== 'PENDING')
      throw new BadRequestException(FriendErrors.REQUEST_NOT_PENDING);

    const [updatedRequest] = await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      // Create both sides of the friendship
      this.prisma.friendship.create({
        data: { userId: request.senderId, friendId: request.receiverId },
      }),
      this.prisma.friendship.create({
        data: { userId: request.receiverId, friendId: request.senderId },
      }),
    ]);

    this.logger.log(
      `Friend request accepted — requestId=${requestId} callerId=${callerId}`,
    );
    return updatedRequest;
  }

  async rejectRequest(callerId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException(FriendErrors.REQUEST_NOT_FOUND);
    if (request.receiverId !== callerId)
      throw new ForbiddenException(FriendErrors.NOT_RECEIVER);
    if (request.status !== 'PENDING')
      throw new BadRequestException(FriendErrors.REQUEST_NOT_PENDING);

    const updated = await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });

    this.logger.log(
      `Friend request rejected — requestId=${requestId} callerId=${callerId}`,
    );
    return updated;
  }

  async cancelRequest(callerId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException(FriendErrors.REQUEST_NOT_FOUND);
    if (request.senderId !== callerId)
      throw new ForbiddenException(FriendErrors.NOT_SENDER);
    if (request.status !== 'PENDING')
      throw new BadRequestException(FriendErrors.REQUEST_NOT_PENDING);

    const updated = await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(
      `Friend request cancelled — requestId=${requestId} callerId=${callerId}`,
    );
    return updated;
  }

  async listIncomingRequests(callerId: string, query: FriendQueryDto) {
    const { page, limit, skip, sortOrder } = this.normalizePagination(query);

    const [total, requests] = await this.prisma.$transaction([
      this.prisma.friendRequest.count({
        where: { receiverId: callerId, status: 'PENDING' },
      }),
      this.prisma.friendRequest.findMany({
        where: { receiverId: callerId, status: 'PENDING' },
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    // Collect all sender IDs then batch-fetch profiles
    const senderIds = requests.map((r) => r.senderId);
    const usersMap = await this.getUsersMapByIds(senderIds);

    const data = await Promise.all(
      requests.map(async (r) => {
        const senderProfile = usersMap.get(r.senderId) ?? null;
        return {
          ...r,
          sender: senderProfile
            ? {
              id: senderProfile.id,
              name: senderProfile.name,
              email: senderProfile.email,
              friendshipStatus: FriendshipStatus.REQUEST_RECEIVED,
            }
            : null,

          receiver: null, // caller is the receiver; no need to re-fetch self
          mutualFriendsCount: await this.countMutualFriends(callerId, r.senderId),
        };
      }),
    );

    return { data, meta: this.buildMeta(total, page, limit) };
  }

  async listOutgoingRequests(callerId: string, query: FriendQueryDto) {
    const { page, limit, skip, sortOrder } = this.normalizePagination(query);

    const [total, requests] = await this.prisma.$transaction([
      this.prisma.friendRequest.count({
        where: { senderId: callerId, status: 'PENDING' },
      }),
      this.prisma.friendRequest.findMany({
        where: { senderId: callerId, status: 'PENDING' },
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    // Batch-fetch all receiver profiles
    const receiverIds = requests.map((r) => r.receiverId);
    const usersMap = await this.getUsersMapByIds(receiverIds);

    const data = await Promise.all(
      requests.map(async (r) => {
        const receiverProfile = usersMap.get(r.receiverId) ?? null;
        return {
          ...r,
          sender: null, // caller is the sender; no need to re-fetch self
          receiver: receiverProfile
            ? {
              id: receiverProfile.id,
              name: receiverProfile.name,
              email: receiverProfile.email,
              friendshipStatus: FriendshipStatus.REQUEST_SENT,
            }
            : null,

          mutualFriendsCount: await this.countMutualFriends(callerId, r.receiverId),
        };
      }),
    );

    return { data, meta: this.buildMeta(total, page, limit) };
  }

  // ─────────────────────────────────────────
  //  Friendships
  // ─────────────────────────────────────────

  async listFriends(callerId: string, query: FriendQueryDto) {
    const { page, limit, skip, sortOrder } = this.normalizePagination(query);

    const [total, friendships] = await this.prisma.$transaction([
      this.prisma.friendship.count({ where: { userId: callerId } }),
      this.prisma.friendship.findMany({
        where: { userId: callerId },
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    // Batch-fetch friend profiles in one round-trip to auth-service
    const friendIds = friendships.map((f) => f.friendId);
    const usersMap = await this.getUsersMapByIds(friendIds);

    const data = await Promise.all(
      friendships.map(async (f) => {
        const profile = usersMap.get(f.friendId) ?? null;
        return {
          ...f,
          friend: profile
            ? {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              friendshipStatus: FriendshipStatus.FRIEND,
            }
            : null,

          mutualFriendsCount: await this.countMutualFriends(callerId, f.friendId),
        };
      }),
    );

    return { data, meta: this.buildMeta(total, page, limit) };
  }

  async removeFriend(callerId: string, friendId: string) {
    if (callerId === friendId) {
      throw new BadRequestException('You cannot unfriend yourself.');
    }

    const friendship = await this.prisma.friendship.findFirst({
      where: { userId: callerId, friendId },
    });
    if (!friendship) throw new NotFoundException(FriendErrors.FRIENDSHIP_NOT_FOUND);

    // Remove both sides atomically
    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId: callerId, friendId },
            { userId: friendId, friendId: callerId },
          ],
        },
      }),
      // Also update any accepted request record for audit trail
      this.prisma.friendRequest.updateMany({
        where: {
          OR: [
            { senderId: callerId, receiverId: friendId },
            { senderId: friendId, receiverId: callerId },
          ],
          status: 'ACCEPTED',
        },
        data: { status: 'CANCELLED' },
      }),
    ]);

    this.logger.log(
      `Friendship removed — callerId=${callerId} friendId=${friendId}`,
    );
    return { message: 'Friend removed successfully.' };
  }

  async checkFriendship(callerId: string, targetId: string) {
    if (callerId === targetId) {
      throw new BadRequestException('You cannot check friendship with yourself.');
    }

    const [friendship, mutualFriendsCount, statuses] = await Promise.all([
      this.prisma.friendship.findFirst({
        where: { userId: callerId, friendId: targetId },
      }),
      this.countMutualFriends(callerId, targetId),
      this.getFriendshipStatuses(callerId, [targetId]),
    ]);

    return {
      areFriends: !!friendship,
      friendshipStatus: statuses.get(targetId) ?? FriendshipStatus.NONE,
      mutualFriendsCount,
    };

  }

  // ─────────────────────────────────────────
  //  Search
  // ─────────────────────────────────────────

  /**
   * Search within the caller's friend list by name or email.
   * Fetches the full friend list IDs, batch-fetches profiles from auth-service,
   * then filters client-side against the search term.
   */
  async searchFriends(callerId: string, query: SearchQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(1, Number(query.limit ?? this.defaultPageSize)), this.maxPageSize);
    const q = (query.q ?? '').toLowerCase().trim();

    // Fetch ALL friendship records for the caller (no pagination yet — filter first)
    const friendships = await this.prisma.friendship.findMany({
      where: { userId: callerId },
      orderBy: { createdAt: 'desc' },
    });

    if (friendships.length === 0) {
      return { data: [], meta: this.buildMeta(0, page, limit) };
    }

    // Batch-fetch all friend profiles
    const usersMap = await this.getUsersMapByIds(friendships.map((f) => f.friendId));

    // Filter by search term against name or email
    const matched = friendships.filter((f) => {
      const profile = usersMap.get(f.friendId);
      if (!profile) return false;
      const name = (profile.name ?? '').toLowerCase();
      const email = profile.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    });

    // Paginate matched results
    const total = matched.length;
    const skip = (page - 1) * limit;
    const paginated = matched.slice(skip, skip + limit);

    const data = await Promise.all(
      paginated.map(async (f) => {
        const profile = usersMap.get(f.friendId)!;
        return {
          friendId: f.friendId,
          name: profile.name,
          email: profile.email,
          mutualFriendsCount: await this.countMutualFriends(callerId, f.friendId),
          friendsSince: f.createdAt,
          friendshipStatus: FriendshipStatus.FRIEND,
        };

      }),
    );

    return { data, meta: this.buildMeta(total, page, limit) };
  }

  /**
   * Search all platform users by name or email via auth-service.
   * Enriches each result with friendship status and mutual friend count.
   */
  async searchUsers(callerId: string, query: SearchQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(1, Number(query.limit ?? this.defaultPageSize)), this.maxPageSize);
    const q = (query.q ?? '').trim();

    const { data: users, total } = await this.searchUsersFromAuth(q, page, limit);

    // Exclude the caller from results
    const filtered = users.filter((u) => u.id !== callerId);

    if (filtered.length === 0) {
      return { data: [], meta: this.buildMeta(total, page, limit) };
    }

    // Determine detailed friendship status for each user
    const statuses = await this.getFriendshipStatuses(callerId, filtered.map((u) => u.id));

    const data = await Promise.all(
      filtered.map(async (u) => {
        const friendshipStatus = statuses.get(u.id) ?? FriendshipStatus.NONE;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          isFriend: friendshipStatus === FriendshipStatus.FRIEND,
          friendshipStatus,
          mutualFriendsCount: await this.countMutualFriends(callerId, u.id),
        };
      }),
    );


    return { data, meta: this.buildMeta(total, page, limit) };
  }
}
