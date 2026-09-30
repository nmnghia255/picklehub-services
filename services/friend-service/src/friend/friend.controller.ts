import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
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
import { FriendService } from './friend.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendQueryDto, SortOrder } from './dto/friend-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  CheckFriendshipResponseDto,
  FriendRequestDto,
  MessageResponseDto,
  PaginatedFriendRequestsDto,
  PaginatedFriendshipsDto,
  PaginatedFriendSearchDto,
  PaginatedGlobalUserSearchDto,
} from './dto/friend-responses.dto';

@ApiTags('Friends')
@Controller('api/friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  // ─────────────────────────────────────────
  //  Requests
  // ─────────────────────────────────────────

  @Post('requests')
  @ApiOperation({ summary: 'Send friend request' })
  @ApiBody({ type: SendFriendRequestDto })
  @ApiResponse({ status: 201, description: 'Request sent successfully.', type: FriendRequestDto })
  @ApiResponse({ status: 400, description: 'Cannot add self.' })
  @ApiResponse({ status: 403, description: 'Blocked by user.' })
  @ApiResponse({ status: 409, description: 'Duplicate request or already friends.' })
  @HttpCode(HttpStatus.CREATED)
  sendRequest(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendService.sendRequest(req.user?.sub ?? '', dto);
  }

  @Patch('requests/:id/accept')
  @ApiOperation({ summary: 'Accept a friend request' })
  @ApiParam({ name: 'id', description: 'Request ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Request accepted.', type: FriendRequestDto })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 403, description: 'Not receiver.' })
  @ApiResponse({ status: 404, description: 'Request not found.' })
  @HttpCode(HttpStatus.OK)
  acceptRequest(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.friendService.acceptRequest(req.user?.sub ?? '', id);
  }

  @Patch('requests/:id/reject')
  @ApiOperation({ summary: 'Reject a friend request' })
  @ApiParam({ name: 'id', description: 'Request ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Request rejected.', type: FriendRequestDto })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 403, description: 'Not receiver.' })
  @ApiResponse({ status: 404, description: 'Request not found.' })
  @HttpCode(HttpStatus.OK)
  rejectRequest(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.friendService.rejectRequest(req.user?.sub ?? '', id);
  }

  @Patch('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel an outgoing friend request' })
  @ApiParam({ name: 'id', description: 'Request ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Request cancelled.', type: FriendRequestDto })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 403, description: 'Not sender.' })
  @ApiResponse({ status: 404, description: 'Request not found.' })
  @HttpCode(HttpStatus.OK)
  cancelRequest(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.friendService.cancelRequest(req.user?.sub ?? '', id);
  }

  @Get('requests/incoming')
  @ApiOperation({
    summary: 'List incoming pending requests',
    description: 'Returns pending friend requests sent to you, enriched with sender name/email and mutual friend counts. Supports pagination and sort order.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder, example: SortOrder.DESC })
  @ApiResponse({ status: 200, description: 'Paginated incoming requests.', type: PaginatedFriendRequestsDto })
  @HttpCode(HttpStatus.OK)
  listIncoming(
    @Request() req: { user?: { sub?: string } },
    @Query() query: FriendQueryDto,
  ) {
    return this.friendService.listIncomingRequests(req.user?.sub ?? '', query);
  }

  @Get('requests/outgoing')
  @ApiOperation({
    summary: 'List outgoing pending requests',
    description: 'Returns pending friend requests you have sent, enriched with receiver name/email and mutual friend counts. Supports pagination and sort order.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder, example: SortOrder.DESC })
  @ApiResponse({ status: 200, description: 'Paginated outgoing requests.', type: PaginatedFriendRequestsDto })
  @HttpCode(HttpStatus.OK)
  listOutgoing(
    @Request() req: { user?: { sub?: string } },
    @Query() query: FriendQueryDto,
  ) {
    return this.friendService.listOutgoingRequests(req.user?.sub ?? '', query);
  }

  // ─────────────────────────────────────────
  //  Friendships
  // ─────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List friends',
    description: 'Returns your friend list, each entry enriched with friend name/email and mutual friend count. Supports pagination and sort order.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder, example: SortOrder.DESC })
  @ApiResponse({ status: 200, description: 'Paginated friends.', type: PaginatedFriendshipsDto })
  @HttpCode(HttpStatus.OK)
  listFriends(
    @Request() req: { user?: { sub?: string } },
    @Query() query: FriendQueryDto,
  ) {
    return this.friendService.listFriends(req.user?.sub ?? '', query);
  }

  @Get('check/:userId')
  @ApiOperation({
    summary: 'Check if you are friends with a user',
    description: 'Returns friendship status and the number of mutual friends regardless of friendship status.',
  })
  @ApiParam({ name: 'userId', description: 'User ID to check against', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Friendship status and mutual friends count.', type: CheckFriendshipResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot check friendship with yourself.' })
  @HttpCode(HttpStatus.OK)
  checkFriendship(
    @Request() req: { user?: { sub?: string } },
    @Param('userId') targetId: string,
  ) {
    return this.friendService.checkFriendship(req.user?.sub ?? '', targetId);
  }

  @Delete(':friendId')
  @ApiOperation({ summary: 'Remove a friend' })
  @ApiParam({ name: 'friendId', description: 'Friend User ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Friend removed.', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot unfriend yourself.' })
  @ApiResponse({ status: 404, description: 'Friendship not found.' })
  @HttpCode(HttpStatus.OK)
  removeFriend(
    @Request() req: { user?: { sub?: string } },
    @Param('friendId') friendId: string,
  ) {
    return this.friendService.removeFriend(req.user?.sub ?? '', friendId);
  }

  // ─────────────────────────────────────────
  //  Search
  // ─────────────────────────────────────────

  @Get('search')
  @ApiOperation({
    summary: 'Search within your friend list',
    description:
      'Case-insensitive search by name or email across your existing friends. ' +
      'Returns friend name, email, mutual friend count, and friendship date.',
  })
  @ApiQuery({ name: 'q', required: true, example: 'jane', description: 'Search term (name or email).' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Matching friends.', type: PaginatedFriendSearchDto })
  @HttpCode(HttpStatus.OK)
  searchFriends(
    @Request() req: { user?: { sub?: string } },
    @Query() query: SearchQueryDto,
  ) {
    return this.friendService.searchFriends(req.user?.sub ?? '', query);
  }

  @Get('users/search')
  @ApiOperation({
    summary: 'Search all platform users globally',
    description:
      'Case-insensitive search by name or email across all platform users via auth-service. ' +
      'Each result indicates whether the user is already your friend and shows mutual friend count.',
  })
  @ApiQuery({ name: 'q', required: true, example: 'john', description: 'Search term (name or email).' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Matching users.', type: PaginatedGlobalUserSearchDto })
  @HttpCode(HttpStatus.OK)
  searchUsers(
    @Request() req: { user?: { sub?: string } },
    @Query() query: SearchQueryDto,
  ) {
    return this.friendService.searchUsers(req.user?.sub ?? '', query);
  }
}
