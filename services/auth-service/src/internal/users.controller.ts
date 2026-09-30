import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ApiExcludeController } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

const INTERNAL_HEADER = 'x-internal-token';

@ApiExcludeController()
@Controller('internal/users')
export class InternalUsersController {
  constructor(private readonly prisma: PrismaService) {}

  private checkToken(headers: any) {
    const token = process.env.SERVICE_INTERNAL_TOKEN;
    if (!token) throw new ForbiddenException('internal token not configured');
    if (headers[INTERNAL_HEADER] !== token) {
      throw new ForbiddenException('invalid internal token');
    }
  }

  /**
   * GET /api/auth/internal/users?q=&page=&limit=
   * Search users by name or email (case-insensitive, partial match).
   * Returns a paginated { data, meta } envelope.
   */
  @Get()
  async searchUsers(
    @Query('q') q: string = '',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Headers() headers: any,
  ) {
    this.checkToken(headers);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
    ]);

    return {
      data: users,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limitNum),
      },
    };
  }

  @Get(':userId')
  async getUserById(@Param('userId') userId: string, @Headers() headers: any) {
    this.checkToken(headers);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    });
    return user;
  }

  @Post('batch')
  async getUsersByIds(
    @Body() body: { userIds: string[] },
    @Headers() headers: any,
  ) {
    this.checkToken(headers);
    const userIds = Array.isArray(body?.userIds) ? body.userIds.filter(Boolean) : [];
    if (userIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    });

    return users;
  }

  @Patch(':userId')
  async updateInternalUser(
    @Param('userId') userId: string,
    @Body() body: { name?: string; avatarUrl?: string },
    @Headers() headers: any,
  ) {
    this.checkToken(headers);
    const updateData: Prisma.UserUpdateInput = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;

    if (Object.keys(updateData).length === 0) {
      return { success: true };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { success: true };
  }
}
