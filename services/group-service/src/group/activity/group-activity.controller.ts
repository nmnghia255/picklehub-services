import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GroupActivityService } from './group-activity.service';
import { CreateGroupActivityDto } from './dto/create-group-activity.dto';
import { UpdateGroupActivityDto } from './dto/update-group-activity.dto';
import { ListGroupActivitiesQueryDto } from './dto/list-group-activities.query.dto';
import { ListMembersQueryDto } from '../dto/list-members.query.dto';

type AuthRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags('Group Activities')
@Controller('api/groups/:groupId/activities')
@ApiBearerAuth('access-token')
export class GroupActivityController {
  constructor(private readonly groupActivityService: GroupActivityService) { }

  @Post()
  @ApiOperation({ summary: 'Create group activity (Owner/Admin)', description: 'Creates a new scheduled activity (practice, meetup, match, etc.) for the group. Required fields: title, activityType, startAt, endAt.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiBody({ type: CreateGroupActivityDto })
  @ApiResponse({ status: 201, description: 'Activity created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g., startAt >= endAt)' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not Owner or Admin' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateGroupActivityDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not identified');
    return this.groupActivityService.createActivity(userId, groupId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List group activities (Owner/Member)', description: 'Returns a paginated list of group activities. Filter by type (UPCOMING/PAST) or use ?hasExpense=true|false to filter by expense status.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Paginated list of activities' })
  @HttpCode(HttpStatus.OK)
  list(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: ListGroupActivitiesQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not identified');
    return this.groupActivityService.listActivities(userId, groupId, query);
  }

  @Get(':activityId')
  @ApiOperation({ summary: 'Get activity details (Owner/Member)', description: 'Returns full detail of a single activity, including attendance count and attendance list with each member\'s status and guest info.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Activity details' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not identified');
    return this.groupActivityService.getActivity(userId, groupId, activityId);
  }

  @Patch(':activityId')
  @ApiOperation({ summary: 'Update group activity (Owner/Admin)', description: 'Updates activity fields (title, description, location, time, status). Set status to CANCELLED to cancel the session.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity ID (UUID)' })
  @ApiBody({ type: UpdateGroupActivityDto })
  @ApiResponse({ status: 200, description: 'Activity updated successfully' })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateGroupActivityDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not identified');
    return this.groupActivityService.updateActivity(userId, groupId, activityId, dto);
  }

  @Delete(':activityId')
  @ApiOperation({ summary: 'Delete group activity (Owner/Admin)', description: 'Permanently deletes the activity from the group schedule. Associated reminder jobs are also removed.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Activity deleted successfully' })
  @HttpCode(HttpStatus.OK)
  remove(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not identified');
    return this.groupActivityService.deleteActivity(userId, groupId, activityId);
  }

  @Get(':activityId/members')
  @ApiOperation({ summary: 'List group members with activity attendance status', description: 'Lists all group members along with their attendance status and guest requests for this specific activity.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of members with activity status returned' })
  @HttpCode(HttpStatus.OK)
  listMembers(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Query() query: ListMembersQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('User not identified');
    return this.groupActivityService.getActivityMembers(userId, groupId, activityId, query);
  }
}
