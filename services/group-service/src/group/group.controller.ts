import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UnauthorizedException
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateGroupDto } from './dto/create-group.dto';
import { ListGroupsQueryDto } from './dto/list-groups.query.dto';
import { ListMyGroupsQueryDto } from './dto/list-my-groups.query.dto';
import { ListMembersQueryDto } from './dto/list-members.query.dto';
import { SendGroupNotificationDto } from './dto/send-group-notification.dto';
import {
  AdminGroupListItem,
  MyGroupListItem,
  PaginatedResult,
} from './dto/list-groups.response.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupService } from './group.service';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireSubscription } from '../guards/user-subscription.guard';
import { NotificationService } from '../notification/notification.service';


type GroupRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags('Groups')
@Controller('api/groups')
export class GroupController {
  constructor(
    private readonly groupService: GroupService,
    private readonly notificationService: NotificationService,
  ) { }

  @Post()
  @ApiBearerAuth('access-token')
  @RequireSubscription('GROUP_OWNER')
  @ApiOperation({
    summary: 'Create a group (Member)',
    description: 'Create a new private group and assign caller as OWNER.',
  })
  @ApiBody({ type: CreateGroupDto })
  @ApiResponse({
    status: 201,
    description: 'Group created successfully.',
    schema: {
      example: {
        id: '1f9f4f0a-5cf0-40d4-94f2-d8fa40ed9658',
        name: 'Sunrise Pickleball Club',
        description: 'Friendly neighborhood morning group',
        avatarUrl: 'https://cdn.picklehub.app/groups/sunrise.png',
        createdBy: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
        createdAt: '2026-03-19T06:00:00.000Z',
        role: 'OWNER',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Group name already exists for owner.' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req: GroupRequest,
    @Body() dto: CreateGroupDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.groupService.createGroup(userId, dto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({
    summary: 'List all groups (Admin)',
    description: 'Return paginated list of all groups in the system.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated groups list.',
    schema: {
      example: {
        data: [
          {
            id: '1f9f4f0a-5cf0-40d4-94f2-d8fa40ed9658',
            name: 'Sunrise Pickleball Club',
            description: 'Friendly neighborhood morning group',
            avatarUrl: null,
            maxMembers: 50,
            memberCount: 12,
            role: null,
            createdAt: '2026-03-19T06:00:00.000Z',
            status: 'ACTIVE',
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  listForAdmin(
    @Query() query: ListGroupsQueryDto,
  ): Promise<PaginatedResult<AdminGroupListItem>> {
    return this.groupService.getAllGroupsForAdmin(query);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List my groups (Owner/Member)',
    description: 'Return paginated groups where the caller is a member.',
  })
  @ApiResponse({ status: 200, description: 'Paginated caller groups.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @HttpCode(HttpStatus.OK)
  listMine(
    @Request() req: GroupRequest,
    @Query() query: ListMyGroupsQueryDto,
  ): Promise<PaginatedResult<MyGroupListItem>> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.getMyGroups(userId, query);
  }

  @Get('users/:userId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List groups by user id (Owner/Member)',
    description:
      'Return a paginated list of groups where the specified user is a member. ' +
      'Supports optional role and status filters.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Target user id (UUID).',
    example: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated groups of target user.',
    schema: {
      example: {
        data: [
          {
            id: '1f9f4f0a-5cf0-40d4-94f2-d8fa40ed9658',
            name: 'Sunrise Pickleball Club',
            description: 'Friendly neighborhood morning group',
            avatarUrl: 'https://cdn.picklehub.app/groups/sunrise.png',
            maxMembers: 50,
            memberCount: 12,
            role: 'owner',
            status: 'ACTIVE',
            createdAt: '2026-03-19T06:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query params or userId format.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @HttpCode(HttpStatus.OK)
  listByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListMyGroupsQueryDto,
  ): Promise<PaginatedResult<MyGroupListItem>> {
    return this.groupService.getGroupsByUserId(userId, query);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get group detail (Owner/Member)',
    description: 'Get one group detail by id if caller is a member (or platform admin).',
  })
  @ApiParam({ name: 'id', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Group detail.',
    content: {
      'application/json': {
        example: {
          id: '5f2f3b7c-2c2f-4f9b-9d5e-1b4f6b9d2c11',
          name: 'Weekend Picklers',
          description: 'Enjoying pickleball matches every Sunday morning.',
          avatarUrl: 'http://example.com/avatar.png',
          maxMembers: 50,
          memberCount: 15,
          status: 'ACTIVE',
          role: 'member',
          subscription: {
            hasAccess: true,
            planType: 'GROUP_OWNER',
            subscriptionId: 'sub-uuid-12345',
            expiresAt: '2026-12-31T23:59:59.000Z',
          },
          createdAt: '2026-07-01T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not a member of the group.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @HttpCode(HttpStatus.OK)
  getOne(@Request() req: GroupRequest, @Param('id') id: string) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.getGroupById(userId, id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update group info (Owner)',
    description: 'OWNER-only update for group profile fields.',
  })
  @ApiParam({ name: 'id', description: 'Group id (UUID).' })
  @ApiBody({ type: UpdateGroupDto })
  @ApiResponse({ status: 200, description: 'Group updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not OWNER or group is not editable.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @ApiResponse({ status: 409, description: 'Duplicate group name for owner.' })
  @HttpCode(HttpStatus.OK)
  updateGroup(
    @Request() req: GroupRequest,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.updateGroupInfo(userId, id, dto);
  }

  @Post(':groupId/notify')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Send notification to group members (Owner)',
    description: 'Send an in-app notification to all members of a group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiBody({ type: SendGroupNotificationDto })
  @ApiResponse({ status: 200, description: 'Notification sent successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not a group member.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @HttpCode(HttpStatus.OK)
  async notifyGroup(
    @Request() req: GroupRequest,
    @Param('groupId') groupId: string,
    @Body() dto: SendGroupNotificationDto,
  ): Promise<{ message: string }> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    await this.groupService.sendGroupNotification(userId, groupId, dto);

    return { message: 'Notification sent successfully.' };
  }

  @Patch(':groupId/archive')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Archive a group (Owner)',
    description: 'OWNER-only soft delete by setting group status to ARCHIVED.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({ status: 200, description: 'Group archived (or already archived).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not OWNER.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @HttpCode(HttpStatus.OK)
  archiveGroup(
    @Request() req: GroupRequest,
    @Param('groupId') groupId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.archiveGroup(userId, groupId);
  }

  @Patch(':groupId/restore')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Restore an archived group (Owner)',
    description: 'OWNER-only group restoration. Sets status to ACTIVE.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Group restored successfully.',
    content: {
      'application/json': {
        example: {
          id: '5f2f3b7c-2c2f-4f9b-9d5e-1b4f6b9d2c11',
          name: 'Weekend Picklers',
          description: 'Enjoying pickleball matches every Sunday morning.',
          avatarUrl: 'http://example.com/avatar.png',
          maxMembers: 50,
          memberCount: 15,
          status: 'ACTIVE',
          role: 'owner',
          createdAt: '2026-07-01T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not OWNER.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @HttpCode(HttpStatus.OK)
  restoreGroup(
    @Request() req: GroupRequest,
    @Param('groupId') groupId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.restoreGroup(userId, groupId);
  }

  @Put(':groupId/owner')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Transfer group ownership (Owner)',
    description: 'Current OWNER transfers group ownership to targetMemberId.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiBody({ type: TransferOwnershipDto })
  @ApiResponse({ status: 200, description: 'Ownership transferred successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid request or target has too many groups.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not the group OWNER or target does not have active subscription.' })
  @ApiResponse({ status: 404, description: 'Group or member not found.' })
  @HttpCode(HttpStatus.OK)
  transferOwnership(
    @Request() req: GroupRequest,
    @Param('groupId') groupId: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.transferOwnership(
      userId,
      groupId,
      dto.targetMemberId,
    );
  }
}

@ApiTags('Group Members')
@Controller('api/groups/:groupId/members')
@ApiBearerAuth('access-token')
export class GroupMemberController {
  constructor(private readonly groupService: GroupService) { }

  @Get()
  @ApiOperation({
    summary: 'List group members (Owner/Member)',
    description: 'List all members of a group with roles and joined date.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({ status: 200, description: 'Members list returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not a group member.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @HttpCode(HttpStatus.OK)
  list(
    @Request() req: GroupRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: ListMembersQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.getGroupMembers(userId, groupId, query);
  }



  @Delete('me')
  @ApiOperation({
    summary: 'Leave group (Member)',
    description: 'Current user leaves the group voluntarily.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({ status: 200, description: 'Caller left the group.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Cannot leave as sole OWNER.' })
  @ApiResponse({ status: 404, description: 'Group or membership not found.' })
  @HttpCode(HttpStatus.OK)
  leave(
    @Request() req: GroupRequest,
    @Param('groupId') groupId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.leaveGroup(userId, groupId);
  }

  @Delete(':userId')
  @ApiOperation({
    summary: 'Kick member (Owner)',
    description: 'Remove a target member from group according to role hierarchy.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'userId', description: 'Target user id (UUID).' })
  @ApiResponse({ status: 200, description: 'Member removed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller lacks permission to remove target.' })
  @ApiResponse({ status: 404, description: 'Group or member not found.' })
  @HttpCode(HttpStatus.OK)
  remove(
    @Request() req: GroupRequest,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    const callerId = req.user?.userId;
    if (!callerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.groupService.kickMember(callerId, groupId, userId);
  }

}
