import {
    Controller,
    ForbiddenException,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    UseGuards,
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
import { InternalServiceGuard } from './guards/internal-service.guard';

@ApiTags('Internal Social Chat')
@Controller('socials/internal')
@ApiSecurity('internal-service-token')
@UseGuards(InternalServiceGuard)
export class InternalSocialChatController {
    constructor(private readonly prisma: PrismaService) { }

    @Get(':socialId/access/:userId')
    @ApiOperation({
        summary: 'Check social chat access (internal)',
        description:
            'Internal endpoint used by chat-service to verify whether a user can access a social conversation. Frontend clients should not call this endpoint directly; frontend should open a social chat through chat-service, which delegates this access check to event-service.',
    })
    @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
    @ApiParam({ name: 'userId', description: 'User id (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Social chat access granted.',
        schema: {
            example: {
                canAccess: true,
                role: 'PARTICIPANT',
                social: {
                    id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
                    title: 'Morning Pickleball Session',
                    status: 'PUBLISHED',
                    creatorId: 'f326626d-8604-4134-9e84-1e0e8bb35f60',
                    joinedCount: 8,
                },
            },
        },
    })
    @ApiUnauthorizedResponse({ description: 'Missing or invalid internal service token.' })
    @ApiForbiddenResponse({ description: 'User is not allowed to access this social chat.' })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    async checkSocialChatAccess(
        @Param('socialId', new ParseUUIDPipe()) socialId: string,
        @Param('userId', new ParseUUIDPipe()) userId: string,
    ) {
        const social = await this.prisma.social.findUnique({
            where: { id: socialId },
            include: {
                participants: {
                    where: { userId },
                    take: 1,
                },
            },
        });

        if (!social) throw new NotFoundException('Social not found');

        const participant = social.participants[0];
        const isHost = social.creatorId === userId || participant?.isHost === true;
        const isConfirmedParticipant = participant?.status === 'CONFIRMED';

        if (!isHost && !isConfirmedParticipant) {
            throw new ForbiddenException('User is not allowed to access this social chat');
        }

        return {
            canAccess: true,
            role: isHost ? 'HOST' : 'PARTICIPANT',
            social: {
                id: social.id,
                title: social.title,
                status: social.status,
                creatorId: social.creatorId,
                joinedCount: social.joinedCount,
            },
        };
    }
}
