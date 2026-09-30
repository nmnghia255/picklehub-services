import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

const INTERNAL_HEADER = 'x-internal-token';

@ApiTags('Internal Group Chat')
@ApiSecurity('x-internal-token')
@Controller('internal/groups')
export class GroupChatAccessInternalController {
  constructor(private readonly prisma: PrismaService) {}

  private checkInternalToken(headers: Record<string, string | string[] | undefined>) {
    const token = process.env.SERVICE_INTERNAL_TOKEN;
    if (!token) throw new ForbiddenException('Internal token not configured');
    if (headers[INTERNAL_HEADER] !== token) throw new ForbiddenException('Invalid internal token');
  }

  @Get(':groupId/access/:userId')
  @ApiOperation({
    summary: 'Check group chat access (internal)',
    description:
      'Internal endpoint used by chat-service to verify whether a user can access a group conversation. Frontend clients should not call this endpoint directly; frontend should open a group chat through chat-service, which delegates this access check to group-service.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'userId', description: 'User id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Group chat access granted.',
    schema: {
      example: {
        canAccess: true,
        role: 'MEMBER',
        group: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'District 1 Pickleball Club',
          status: 'ACTIVE',
          maxMembers: 50,
          memberCount: 18,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid internal token.' })
  @ApiForbiddenResponse({ description: 'User is not allowed to access this group chat.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async checkGroupChatAccess(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    this.checkInternalToken(headers);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { userId },
          take: 1,
        },
      },
    });

    if (!group) throw new NotFoundException('Group not found');

    const membership = group.members[0];
    if (!membership) {
      throw new ForbiddenException('User is not allowed to access this group chat');
    }

    const memberCount = await this.prisma.groupMember.count({ where: { groupId } });

    return {
      canAccess: true,
      role: membership.role,
      group: {
        id: group.id,
        name: group.name,
        status: group.status,
        maxMembers: group.maxMembers,
        memberCount,
      },
    };
  }
}
