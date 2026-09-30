import { Controller, Get, Param, Post, Body, Headers, ForbiddenException, NotFoundException, ConflictException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { GroupMemberRole } from '@prisma/client';

const INTERNAL_HEADER = 'x-internal-token';

@ApiExcludeController()
@Controller('internal/groups')
export class GroupInternalController {
  constructor(private readonly prisma: PrismaService) {}

  private checkInternalToken(headers: any) {
    const token = process.env.SERVICE_INTERNAL_TOKEN;
    if (!token) throw new ForbiddenException('Internal token not configured');
    if (headers[INTERNAL_HEADER] !== token) throw new ForbiddenException('Invalid internal token');
  }

  @Get(':groupId')
  async getGroup(@Param('groupId') groupId: string, @Headers() headers: any) {
    this.checkInternalToken(headers);
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException();
    const memberCount = await this.prisma.groupMember.count({ where: { groupId } });
    return {
      id: group.id,
      name: group.name,
      maxMembers: group.maxMembers,
      memberCount,
    };
  }

  @Get(':groupId/members/:userId')
  async getMember(@Param('groupId') groupId: string, @Param('userId') userId: string, @Headers() headers: any) {
    this.checkInternalToken(headers);
    const membership = await this.prisma.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
    if (!membership) throw new NotFoundException();
    return { isMember: true, role: membership.role };
  }

  @Post(':groupId/members')
  @HttpCode(HttpStatus.CREATED)
  async addMember(@Param('groupId') groupId: string, @Body() body: { userId: string; role?: string }, @Headers() headers: any) {
    this.checkInternalToken(headers);
    const { userId, role = 'MEMBER' } = body;

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException();

    if (group.maxMembers != null) {
      const memberCount = await this.prisma.groupMember.count({ where: { groupId } });
      if (memberCount >= group.maxMembers) {
        // return 403 to indicate cannot add (full)
        throw new ForbiddenException('Group is full');
      }
    }

    const existing = await this.prisma.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
    if (existing) throw new ConflictException('Already a member');

    const created = await this.prisma.groupMember.create({ data: { userId, groupId, role: role as GroupMemberRole } });
    return { id: created.id, userId: created.userId, groupId: created.groupId, role: created.role };
  }
}
