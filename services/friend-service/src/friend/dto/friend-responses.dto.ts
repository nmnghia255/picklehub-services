import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FriendshipStatus {
  NONE = 'NONE',
  FRIEND = 'FRIEND',
  REQUEST_SENT = 'REQUEST_SENT',
  REQUEST_RECEIVED = 'REQUEST_RECEIVED',
}


export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

// ─── Embedded user profile ────────────────────────────────────────────────────

export class UserProfileDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiPropertyOptional({ example: 'Jane Doe', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({
    example: FriendshipStatus.NONE,
    enum: FriendshipStatus,
    description: 'Relationship status with the caller.',
  })
  friendshipStatus: FriendshipStatus;
}


// ─── Friend Requests ──────────────────────────────────────────────────────────

export class FriendRequestDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  senderId: string;

  @ApiPropertyOptional({ type: () => UserProfileDto, nullable: true })
  sender: UserProfileDto | null;

  @ApiProperty({ example: 'b2c3d4e5-f678-90ab-cdef-1234567890ab' })
  receiverId: string;

  @ApiPropertyOptional({ type: () => UserProfileDto, nullable: true })
  receiver: UserProfileDto | null;

  @ApiProperty({ example: 'PENDING', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'] })
  status: string;

  @ApiProperty({ example: 3, description: 'Number of mutual friends between the requester and the other party.' })
  mutualFriendsCount: number;

  @ApiProperty({ example: '2023-10-10T14:48:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-10-10T14:48:00.000Z' })
  updatedAt: Date;
}

export class PaginatedFriendRequestsDto {
  @ApiProperty({ type: [FriendRequestDto] })
  data: FriendRequestDto[];

  @ApiProperty()
  meta: PaginationMetaDto;
}

// ─── Friendships ──────────────────────────────────────────────────────────────

export class FriendshipDto {
  @ApiProperty({ example: 'c3d4e5f6-7890-abcd-ef12-34567890abcd' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'b2c3d4e5-f678-90ab-cdef-1234567890ab' })
  friendId: string;

  @ApiPropertyOptional({ type: () => UserProfileDto, nullable: true })
  friend: UserProfileDto | null;

  @ApiProperty({ example: 5, description: 'Number of mutual friends between you and this friend.' })
  mutualFriendsCount: number;

  @ApiProperty({ example: '2023-10-10T14:48:00.000Z' })
  createdAt: Date;
}

export class PaginatedFriendshipsDto {
  @ApiProperty({ type: [FriendshipDto] })
  data: FriendshipDto[];

  @ApiProperty()
  meta: PaginationMetaDto;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export class FriendSearchResultDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  friendId: string;

  @ApiPropertyOptional({ example: 'Jane Doe', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: 5 })
  mutualFriendsCount: number;

  @ApiProperty({ example: '2023-10-10T14:48:00.000Z' })
  friendsSince: Date;

  @ApiProperty({
    example: FriendshipStatus.FRIEND,
    enum: FriendshipStatus,
  })
  friendshipStatus: FriendshipStatus;
}


export class PaginatedFriendSearchDto {
  @ApiProperty({ type: [FriendSearchResultDto] })
  data: FriendSearchResultDto[];

  @ApiProperty()
  meta: PaginationMetaDto;
}

export class GlobalUserSearchResultDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiPropertyOptional({ example: 'Jane Doe', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: true, description: 'Whether this user is already your friend.' })
  isFriend: boolean;

  @ApiProperty({
    example: FriendshipStatus.NONE,
    enum: FriendshipStatus,
    description: 'Detailed relationship status with the caller.',
  })
  friendshipStatus: FriendshipStatus;

  @ApiProperty({ example: 3 })
  mutualFriendsCount: number;
}


export class PaginatedGlobalUserSearchDto {
  @ApiProperty({ type: [GlobalUserSearchResultDto] })
  data: GlobalUserSearchResultDto[];

  @ApiProperty()
  meta: PaginationMetaDto;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export class MessageResponseDto {
  @ApiProperty({ example: 'Action successful.' })
  message: string;
}

export class CheckFriendshipResponseDto {
  @ApiProperty({ example: true })
  areFriends: boolean;

  @ApiProperty({
    example: FriendshipStatus.FRIEND,
    enum: FriendshipStatus,
  })
  friendshipStatus: FriendshipStatus;

  @ApiProperty({ example: 3, description: 'Number of mutual friends between the two users.' })
  mutualFriendsCount: number;
}

