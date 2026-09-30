import { Controller, ForbiddenException, Get, Headers, Param } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

const INTERNAL_HEADER = 'x-internal-token';

@ApiTags('Internal Friends')
@ApiSecurity('x-internal-token')
@Controller('internal/friends')
export class InternalFriendController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('check/:userId/:targetId')
  @ApiOperation({
    summary: 'Check friendship for internal services',
    description:
      'Internal endpoint used by chat-service to enforce friends-only direct messages. Frontend clients should use the public friend endpoints instead.',
  })
  @ApiParam({ name: 'userId', example: '11111111-1111-4111-8111-111111111111' })
  @ApiParam({ name: 'targetId', example: '22222222-2222-4222-8222-222222222222' })
  @ApiOkResponse({
    description: 'Friendship status for the two users.',
    schema: {
      example: {
        areFriends: true,
        status: 'FRIEND',
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Missing or invalid internal token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async checkFriendship(
    @Param('userId') userId: string,
    @Param('targetId') targetId: string,
    @Headers() headers: Record<string, string>,
  ) {
    this.checkInternalToken(headers);

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId: targetId },
          { userId: targetId, friendId: userId },
        ],
      },
    });

    return {
      areFriends: !!friendship,
      status: friendship ? 'FRIEND' : 'NONE',
    };
  }

  private checkInternalToken(headers: Record<string, string>) {
    const token = process.env.SERVICE_INTERNAL_TOKEN;
    if (!token) throw new ForbiddenException('SERVICE_INTERNAL_TOKEN is not configured');
    if (headers[INTERNAL_HEADER] !== token) {
      throw new ForbiddenException('Invalid internal token');
    }
  }
}
