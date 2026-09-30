import { Controller, Post, Body, Req, UseGuards, BadRequestException, Param, ParseUUIDPipe, Get, Patch, Delete } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiTags, 
    ApiBadRequestResponse, ApiUnauthorizedResponse, ApiInternalServerErrorResponse, ApiParam, ApiNotFoundResponse, ApiForbiddenResponse} from "@nestjs/swagger";
import { SessionService } from "./session.service";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { CreateSessionDto } from "./dto/create-session.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";

@Controller('socials/:socialId')
@ApiTags('Play Session')
@ApiBearerAuth('access-token')
export class SessionController {
    constructor(private readonly sessionService: SessionService) { }
    
    @Post('play-sessions')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Create play session',
        description: 'Create a play session in a social.',
    })
    @ApiBody({ type: CreateSessionDto })
    @ApiResponse({
        status: 201,
        description: 'created play session successfully.',
        schema: {
            example: {
                message: 'Created play session successfully.',
                data: {
                    id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
                    title: 'Morning Pickleball Session',
                    socialId: 'b5c1d2e3-f4a5-6b7c-8d9e-0f1a2b3c4d5e',
                    bookingIds: ['booking-1', 'booking-2'],
                    joinedCount: 0,
                    numberOfCourts: 2,
                    courtNames: 'Sân 1, Sân 2',
                    location: 'Sports Center ABC, 123 Main St',
                    sessionFee: 500000,
                    startTime: '2026-04-20T07:00:00.000Z',
                    endTime: '2026-04-20T09:00:00.000Z',
                    status: 'PUBLISHED',
                    maxSlot: 20,
                    isHost: true,
                    isParticipant: true,
                    creatorId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
                    createdAt: '2026-04-15T10:30:00.000Z',
                    updatedAt: '2026-04-15T10:30:00.000Z',
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid payload or missing user identity.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    create(
        @Param('socialId', new ParseUUIDPipe()) socialId: string,
        @Body() createSessionDto: CreateSessionDto,
        @Req() request: any
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.sessionService.create(createSessionDto, userId, socialId);
    }

    @Get('play-sessions')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'List play sessions',
        description: 'List all play sessions for a social.',
    })
    @ApiParam({ name: 'socialId', description: 'Social ID (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Play sessions fetched successfully.',
        schema: {
            example: {
                message: 'Play sessions fetched successfully.',
                data: [
                    {
                        id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
                        title: 'Morning Pickleball Session',
                        socialId: 'b5c1d2e3-f4a5-6b7c-8d9e-0f1a2b3c4d5e',
                        bookingIds: ['booking-1', 'booking-2'],
                        joinedCount: 0,
                        numberOfCourts: 2,
                        courtNames: 'Sân 1, Sân 2',
                        location: 'Sports Center ABC, 123 Main St',
                        sessionFee: 500000,
                        startTime: '2026-04-20T07:00:00.000Z',
                        endTime: '2026-04-20T09:00:00.000Z',
                        status: 'PUBLISHED',
                        maxSlot: 20,
                        isHost: true,
                        isParticipant: true,
                        creatorId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
                        creator: {
                            id: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
                            name: 'John Doe',
                            email: 'john.doe@example.com',
                            avatarUrl: 'https://example.com/avatar.jpg',
                        },
                        createdAt: '2026-04-15T10:30:00.000Z',
                        updatedAt: '2026-04-15T10:30:00.000Z',
                    }
                ],
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social ID.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    list(
        @Param('socialId', new ParseUUIDPipe()) socialId: string,
        @Req() request: any,
    ) {
        const userId = request.user?.userId;
        return this.sessionService.listBySocial(socialId, userId);
    }

    @Get('play-sessions/:sessionId')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get play session detail',
        description: 'Get detail for a play session by ID.',
    })
    @ApiParam({ name: 'socialId', description: 'Social ID (UUID).' })
    @ApiParam({ name: 'sessionId', description: 'Play session ID (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Play session fetched successfully.',
        schema: {
            example: {
                message: 'Play session fetched successfully.',
                data: {
                    id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
                    title: 'Morning Pickleball Session',
                    socialId: 'b5c1d2e3-f4a5-6b7c-8d9e-0f1a2b3c4d5e',
                    bookingIds: ['booking-1', 'booking-2'],
                    joinedCount: 0,
                    numberOfCourts: 2,
                    courtNames: 'Sân 1, Sân 2',
                    location: 'Sports Center ABC, 123 Main St',
                    sessionFee: 500000,
                    startTime: '2026-04-20T07:00:00.000Z',
                    endTime: '2026-04-20T09:00:00.000Z',
                    status: 'PUBLISHED',
                    maxSlot: 20,
                    isHost: true,
                    isParticipant: true,
                    creatorId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
                    creator: {
                        id: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
                        name: 'John Doe',
                        email: 'john.doe@example.com',
                        avatarUrl: 'https://example.com/avatar.jpg',
                    },
                    createdAt: '2026-04-15T10:30:00.000Z',
                    updatedAt: '2026-04-15T10:30:00.000Z',
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social ID or session ID.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiNotFoundResponse({ description: 'Social or play session not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    detail(
        @Param('socialId', new ParseUUIDPipe()) socialId: string,
        @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
        @Req() request: any,
    ) {
        const userId = request.user?.userId;
        return this.sessionService.getDetail(socialId, sessionId, userId);
    }

    @Patch('play-sessions/:sessionId')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Update play session',
        description: 'Update a play session in a social.',
    })
    @ApiParam({ name: 'socialId', description: 'Social ID (UUID).' })
    @ApiParam({ name: 'sessionId', description: 'Play session ID (UUID).' })
    @ApiBody({ type: UpdateSessionDto })
    @ApiResponse({
        status: 200,
        description: 'Play session updated successfully.',
        schema: {
            example: {
                message: 'Play session updated successfully.',
                data: {
                    id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
                    title: 'Updated Pickleball Session',
                    socialId: 'b5c1d2e3-f4a5-6b7c-8d9e-0f1a2b3c4d5e',
                    bookingIds: ['booking-1', 'booking-2', 'booking-3'],
                    joinedCount: 0,
                    numberOfCourts: 3,
                    courtNames: 'Sân 1, Sân 2, Sân 3',
                    location: 'Sports Center ABC, 123 Main St',
                    sessionFee: 750000,
                    startTime: '2026-04-20T08:00:00.000Z',
                    endTime: '2026-04-20T10:00:00.000Z',
                    status: 'PUBLISHED',
                    maxSlot: 20,
                    isHost: true,
                    isParticipant: true,
                    creatorId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
                    createdAt: '2026-04-15T10:30:00.000Z',
                    updatedAt: '2026-04-15T11:00:00.000Z',
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid payload, social, or session ID. Cannot update cancelled session or when social is published.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
    @ApiNotFoundResponse({ description: 'Social or play session not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    update(
        @Param('socialId', new ParseUUIDPipe()) socialId: string,
        @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
        @Body() updateSessionDto: UpdateSessionDto,
        @Req() request: any,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.sessionService.update(socialId, sessionId, updateSessionDto, userId);
    }

    @Delete('play-sessions/:sessionId')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Delete play session',
        description: 'Delete a play session in a social.',
    })
    @ApiParam({ name: 'socialId', description: 'Social ID (UUID).' })
    @ApiParam({ name: 'sessionId', description: 'Play session ID (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Play session deleted successfully.',
        schema: {
            example: {
                message: 'Play session deleted successfully.',
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social ID, session ID, or missing user identity.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
    @ApiNotFoundResponse({ description: 'Social or play session not found.' })
    @ApiForbiddenResponse({ description: 'Only the creator can delete play sessions.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    remove(
        @Param('socialId', new ParseUUIDPipe()) socialId: string,
        @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
        @Req() request: any,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.sessionService.remove(socialId, sessionId, userId);
    }

    @Patch('play-sessions/:sessionId/cancel')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Cancel play session',
        description: 'Cancel a play session in a social.',
    })
    @ApiParam({ name: 'socialId', description: 'Social ID (UUID).' })
    @ApiParam({ name: 'sessionId', description: 'Play session ID (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Play session cancelled successfully.',
        schema: {
            example: {
                message: 'Play session cancelled successfully.',
                data: {
                    id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
                    title: 'Morning Pickleball Session',
                    socialId: 'b5c1d2e3-f4a5-6b7c-8d9e-0f1a2b3c4d5e',
                    bookingIds: ['booking-1', 'booking-2'],
                    joinedCount: 0,
                    numberOfCourts: 2,
                    courtNames: 'Sân 1, Sân 2',
                    location: 'Sports Center ABC, 123 Main St',
                    sessionFee: 500000,
                    startTime: '2026-04-20T07:00:00.000Z',
                    endTime: '2026-04-20T09:00:00.000Z',
                    status: 'CANCELLED',
                    maxSlot: 20,
                    isHost: true,
                    isParticipant: true,
                    creatorId: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
                    createdAt: '2026-04-15T10:30:00.000Z',
                    updatedAt: '2026-04-15T11:30:00.000Z',
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social ID, session ID, or session already cancelled.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
    @ApiNotFoundResponse({ description: 'Social or play session not found.' })
    @ApiForbiddenResponse({ description: 'Only the creator can cancel play sessions.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    cancel(
        @Param('socialId', new ParseUUIDPipe()) socialId: string,
        @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
        @Req() request: any,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.sessionService.cancel(socialId, sessionId, userId);
    }

}
