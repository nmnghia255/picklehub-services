import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiSecurity
} from '@nestjs/swagger';
import { Request } from 'express';
import { CreateSocialDto } from './dto/create-social.dto';
import { MyScheduleQueryDto } from './dto/my-schedule-query.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { SocialService } from './social.service';
import { UpdateSocialDto } from './dto/update-social.dto';
import { DiscoverSocialsDto } from './dto/discover-socials.dto';
import { DuplicateSocialDto } from './dto/duplicate-social.dto';
import { QuerySocialsInternalDto } from './dto/query-socials-internal.dto';
import { SubmitSocialFeedbackDto } from './dto/submit-feedback.dto';
import * as jwt from 'jsonwebtoken';

type SocialRequest = Request & {
    user?: {
        userId: string;
        userName?: string;
        email?: string;
        roles?: string[];
    };
};

// #region Swagger Examples Setup

const USER_EXAMPLE_CREATOR = {
    id: 'f326626d-8604-4134-9e84-1e0e8bb35f60',
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
};

const USER_EXAMPLE_PARTICIPANT = {
    id: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
};

const PLAY_SESSION_EXAMPLE = {
    id: 'play-session-uuid-1',
    socialId: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
    title: 'Session 1',
    bookingIds: ['booking-1', 'booking-2'],
    joinedCount: 0,
    numberOfCourts: 2,
    courtNames: 'Sân 1, Sân 2',
    location: 'Sport Center A',
    sessionFee: 100000,
    startTime: '2026-05-20T07:00:00.000Z',
    endTime: '2026-05-20T09:00:00.000Z',
    status: 'ACTIVE',
    creatorId: 'f326626d-8604-4134-9e84-1e0e8bb35f60',
    createdAt: '2026-05-18T10:30:00.000Z',
    updatedAt: '2026-05-18T10:30:00.000Z',
};

const SOCIAL_EXAMPLE_BASE = {
    id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
    title: 'Morning Pickleball Session',
    note: 'Join us playing Pickleball, remember to pay the fee',
    startTime: '2026-04-20T07:00:00.000Z',
    endTime: '2026-04-20T09:00:00.000Z',
    totalBookingCost: 100000,
    packageFee: null,
    totalExpense: 0,
    paymentBankName: null,
    paymentAccountName: null,
    paymentAccountNumber: null,
    paymentQrUrl: null,
    paymentNote: null,
    hasAvailableSlots: true,
    genderPolicy: 'ANY',
    ageGroup: 'ANY',
    format: 'SOCIAL',
    submitDupr: false,
    minimumLevel: null,
    maximumLevel: null,
    isFree: false,
    autoApproveJoinRequests: true,
    hostRole: 'HOST_AND_PLAY',
    cancellationFreezeHours: null,
    joinedCount: 8,
    status: 'PUBLISHED',
    creatorId: USER_EXAMPLE_CREATOR.id,
    createdAt: '2026-04-20T06:55:00.000Z',
    updatedAt: '2026-04-20T06:55:00.000Z',
};

const {
    totalBookingCost: _unused1,
    packageFee: _unused2,
    totalExpense: _unused3,
    paymentBankName: _unused4,
    paymentAccountName: _unused5,
    paymentAccountNumber: _unused6,
    paymentQrUrl: _unused7,
    paymentNote: _unused8,
    autoApproveJoinRequests: _unused9,
    hostRole: _unused10,
    cancellationFreezeHours: _unused11,
    ...SOCIAL_SUMMARY_EXAMPLE_BASE
} = SOCIAL_EXAMPLE_BASE;

// #endregion

@ApiTags('Socials')
@Controller('socials')
@ApiBearerAuth('access-token')
export class SocialController {
    constructor(private readonly socialService: SocialService) { }

    // #region POST /socials
    @Post()
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Create social',
        description: 'Create a new social.',
    })
    @ApiBody({ type: CreateSocialDto })
    @ApiResponse({
        status: 201,
        description: 'Social created',
        schema: {
            example: {
                message: 'Social created',
                data: {
                    ...SOCIAL_EXAMPLE_BASE,
                    totalBookingCost: 0,
                    joinedCount: 0,
                    status: 'DRAFT',
                    playSessions: [],
                    participants: [],
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid payload or missing user identity.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    create(
        @Body() createSocialDto: CreateSocialDto,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.socialService.create(createSocialDto, userId);
    }
    // #endregion

    // #region GET /socials/discover
    @Get('discover')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Discover socials',
        description:
            'Discover socials with various filter options and pagination. Only returns socials in PUBLISHED status.',
    })
    @ApiResponse({
        status: 200,
        description: 'Get socials for discovery successfully',
        schema: {
            example: {
                message: 'Get socials for discovery successfully',
                data: [
                    {
                        ...SOCIAL_SUMMARY_EXAMPLE_BASE,
                        id: 'e966ec2b-8bf6-4cc0-9372-c5488b0726a3',
                        title: 'Picklehub Team New Weekly Socials',
                        note: 'Friendly pickleball for only Picklehub team, remember to bring your own equipments. This socials now for female only.',
                        startTime: null,
                        endTime: null,
                        genderPolicy: 'FEMALE_ONLY',
                        ageGroup: 'SENIOR',
                        minimumLevel: '2.5',
                        maximumLevel: '5',
                        joinedCount: 0,
                        creatorId: USER_EXAMPLE_CREATOR.id,
                        creator: USER_EXAMPLE_CREATOR,
                        createdAt: '2026-05-15T09:15:05.372Z',
                        updatedAt: '2026-05-15T09:19:42.724Z',
                        _count: {
                            participants: 1,
                            playSessions: 0,
                        },
                        isHost: true,
                        isParticipant: true,
                        MyParticipantStatus: 'CONFIRMED',
                    }
                ],
                meta: {
                    page: 1,
                    limit: 10,
                    total: 3,
                    totalPages: 1
                }
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid query filter combination.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    discover(@Query() query: DiscoverSocialsDto, @Req() request: any) {
        const authHeader = request.headers?.authorization;
        let userId: string | undefined;
        if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.decode(token) as any;
                userId = decoded?.sub || decoded?.userId;
            } catch (e) {
                // Ignore decoding errors
            }
        }
        return this.socialService.discover(query, userId);
    }
    // #endregion

    // #region GET /socials/all
    // List all socials without pagination for internal use.
    @Get('all')
    @ApiOperation({
        summary: 'List all socials',
        description: 'Retrieve all socials without pagination for internal use.',
    })
    @ApiSecurity('internal-service-token')
    @ApiResponse({
        status: 200,
        description: 'Socials fetched',
        schema: {
            example: {
                message: "Successfully retrieved socials",
                data: [
                    {
                        ...SOCIAL_EXAMPLE_BASE,
                        id: 'bdd04045-d764-494a-a239-0277ec04ec1d',
                        title: 'Picklehub Team Weekly Socials',
                        note: 'Friendly mixed-level games. Bring your own paddle.',
                        startTime: null,
                        endTime: null,
                        totalBookingCost: 0,
                        genderPolicy: 'FEMALE_ONLY',
                        ageGroup: 'SENIOR',
                        minimumLevel: '2.5',
                        maximumLevel: '5',
                        joinedCount: 0,
                        status: 'DRAFT',
                        creatorId: USER_EXAMPLE_CREATOR.id,
                        creator: USER_EXAMPLE_CREATOR,
                        createdAt: '2026-05-14T13:57:15.647Z',
                        updatedAt: '2026-05-14T13:57:15.647Z',
                    },
                ]
            },
        }
    })
    @ApiUnauthorizedResponse({ description: 'Missing or invalid Authorization header' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(InternalServiceGuard)
    listAll() {
        return this.socialService.listAll();
    }
    // #endregion

    // #region GET /socials/my-schedule
    @Get('my-schedule')
    @ApiBearerAuth('access-token')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Get personal social schedule',
        description:
            'Returns personal socials for the current user by timeframe (upcoming/past) with basic pagination.',
    })
    @ApiResponse({
        status: 200,
        description: 'Personal schedule fetched',
        schema: {
            example: {
                message: "Get personal schedule successfully",
                data: [
                    {
                        ...SOCIAL_SUMMARY_EXAMPLE_BASE,
                        id: 'd4427742-72df-4159-ae24-9c3476a31514',
                        title: 'Weekend Doubles Session',
                        note: 'Friendly mixed-level games. Bring your own paddle.',
                        startTime: '2026-04-29T07:00:00.000Z',
                        endTime: '2026-04-30T15:00:00.000Z',
                        joinedCount: 0,
                        status: 'DRAFT',
                        creatorId: USER_EXAMPLE_CREATOR.id,
                        creator: USER_EXAMPLE_CREATOR,
                        createdAt: '2026-05-13T10:52:08.062Z',
                        updatedAt: '2026-05-13T10:52:08.062Z',
                        _count: {
                            participants: 1,
                            playSessions: 1,
                        },
                        isHost: true,
                        isParticipant: true,
                        MyParticipantStatus: 'CONFIRMED',
                    }
                ],
                meta: {
                    total: 1,
                    page: 1,
                    limit: 10
                }
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid timeframe/page/limit query parameters.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    mySchedule(
        @Req() request: SocialRequest,
        @Query() query: MyScheduleQueryDto,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new UnauthorizedException('Unable to identify current user');
        }

        return this.socialService.mySchedule(
            userId,
            query,
        );
    }
    // #endregion

    // #region GET /socials/:id
    @Get(':id')
    @ApiBearerAuth('access-token')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Get social detail',
        description: 'Get one social by id.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Social fetched.\n\n' +
            '**Participant Payment Statuses (`myParticipantInfo.paymentStatus`):**\n' +
            '- `UNPAID`: Player has not paid anything toward their totalFee yet.\n' +
            '- `PARTIALLY_PAID`: Player paid some amount, but less than their totalFee.\n' +
            '- `PAID`: Player paid exactly their totalFee.\n' +
            '- `OVERPAID`: Player paid more than their totalFee.\n' +
            '- `REFUNDED`: Host processed refund / returned all paid amount.',
        schema: {
            example: {
                message: 'Social fetched',
                data: {
                    ...SOCIAL_EXAMPLE_BASE,
                    totalBookingCost: 0,
                    creator: USER_EXAMPLE_CREATOR,
                    _count: {
                        participants: 1,
                        playSessions: 0,
                    },
                    isHost: true,
                    isParticipant: true,
                    myParticipantInfo: {
                        id: '7b70d588-6625-455b-bb66-b33df0fd0d05',
                        status: 'CONFIRMED',
                        totalFee: 0,
                        amountPaid: 0,
                        amountRefunded: 0,
                        amountDue: 0,
                        amountOverpaid: 0,
                        isFullPackage: true,
                        paymentStatus: 'PAID',
                        joinedAt: '2026-05-18T10:35:00.000Z',
                        joinedSessionIds: [],
                        paymentUrl: 'https://example.com/receipt.jpg',
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social id.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    get(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        return this.socialService.getOneById(id, userId);
    }
    // #endregion

    // #region PATCH /socials/:id
    @Patch(':id')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Update social',
        description: 'Update one social by id',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiBody({ type: UpdateSocialDto })
    @ApiResponse({
        status: 200,
        description: 'Social updated',
        schema: {
            example: {
                message: "Social updated successfully",
                data: {
                    ...SOCIAL_EXAMPLE_BASE,
                    id: "d7bd7cc0-497b-40ed-b467-ba6df0fd0d05",
                    title: "Picklehub Team New Weekly Socials 4",
                    note: "Friendly pickleball for only Picklehub team, remember to bring your own equipments. This socials now for female only.",
                    startTime: null,
                    endTime: null,
                    totalBookingCost: 0,
                    genderPolicy: "FEMALE_ONLY",
                    ageGroup: "SENIOR",
                    minimumLevel: "2.5",
                    maximumLevel: "5",
                    joinedCount: 0,
                    creatorId: USER_EXAMPLE_CREATOR.id,
                    createdAt: "2026-05-18T10:36:11.776Z",
                    updatedAt: "2026-05-18T14:01:02.274Z",
                    playSessions: [
                        {
                            ...PLAY_SESSION_EXAMPLE,
                            id: 'play-session-uuid',
                            socialId: 'd7bd7cc0-497b-40ed-b467-ba6df0fd0d05',
                            creatorId: USER_EXAMPLE_CREATOR.id,
                        },
                    ]
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social id or request body.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() updateSocialDto: UpdateSocialDto,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.socialService.update(id, updateSocialDto, userId);
    }
    // #endregion

    // #region PATCH /socials/:id/publish
    @Patch(':id/publish')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Publish social',
        description: 'Publish a social by id.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Social published',
        schema: {
            example: {
                message: 'Social published successfully',
                data: {
                    ...SOCIAL_EXAMPLE_BASE,
                    totalBookingCost: 0,
                    joinedCount: 0,
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social id or social cannot be published.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    publish(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.socialService.publish(id, userId);
    }
    // #endregion

    // #region PATCH /socials/:id/complete
    @Patch(':id/complete')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Complete social',
        description: 'Complete/end a published social by id. Cascades to active/in-progress play sessions.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Social completed. Note: If social is already COMPLETED, returns only { id, status, creatorId }.',
        schema: {
            example: {
                message: 'Social completed successfully',
                data: {
                    ...SOCIAL_EXAMPLE_BASE,
                    status: 'COMPLETED',
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social id or social cannot be completed (must be PUBLISHED).' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    @ApiForbiddenResponse({ description: 'Only the creator can complete this social.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    complete(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.socialService.complete(id, userId);
    }
    // #endregion

    // #region DELETE /socials/:id
    @Delete(':id')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Delete social',
        description: 'Delete one social by id.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Social deleted',
        schema: {
            example: {
                message: 'Social deleted successfully',
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid payload or missing user identity.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT.' })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    remove(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        const userName = request.user?.email;

        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        const finalUserName = userName ? userName : 'an organizer';

        return this.socialService.remove(id, userId, finalUserName);
    }
    // #endregion

    /**
     *  Duplicate social
     */
    // #region POST /socials/:id/duplicate
    @Post(':id/duplicate')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Duplicate social',
        description: 'Duplicate one social by id. The duplicated social will be in DRAFT status with new play sessions.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiBody({ type: DuplicateSocialDto })
    @ApiResponse({
        status: 201,
        description: 'Social duplicated successfully',
        schema: {
            example: {
                message: 'Social duplicated successfully',
                data: {
                    ...SOCIAL_EXAMPLE_BASE,
                    id: 'new-social-uuid-here',
                    title: 'Social mới từ Morning Pickleball Session',
                    startTime: '2026-05-20T07:00:00.000Z',
                    endTime: '2026-05-20T09:00:00.000Z',
                    totalBookingCost: 100000,
                    joinedCount: 0,
                    status: 'DRAFT',
                    creatorId: 'user-id-here',
                    createdAt: '2026-05-18T10:30:00.000Z',
                    updatedAt: '2026-05-18T10:30:00.000Z',
                    playSessions: [
                        {
                            ...PLAY_SESSION_EXAMPLE,
                            id: 'play-session-uuid',
                            socialId: 'new-social-uuid-here',
                            creatorId: 'user-id-here',
                        }
                    ],
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid social id or invalid duplicate request payload.' })
    @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
    @ApiNotFoundResponse({ description: 'Source social not found.' })
    @ApiForbiddenResponse({ description: 'Only social creator can duplicate.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    @UseGuards(JwtAuthGuard)
    duplicate(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() duplicateSocialDto: DuplicateSocialDto,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new BadRequestException('Invalid payload or missing user identity.');
        }

        return this.socialService.duplicate(id, userId, duplicateSocialDto);
    }
    // #endregion

    @Get(':id/stats')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Get social statistics',
        description: 'Retrieve computed statistics for a completed social.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Social statistics retrieved successfully.',
    })
    @ApiForbiddenResponse({ description: 'Only confirmed participants or the host can view social statistics.' })
    @ApiNotFoundResponse({ description: 'Social or statistics not found.' })
    getSocialStats(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new UnauthorizedException('Unable to identify current user');
        }
        return this.socialService.getSocialStats(id, userId);
    }

    @Post(':id/feedback')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Submit feedback',
        description: 'Allows a confirmed participant to submit rating/comment for a completed social.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiBody({ type: SubmitSocialFeedbackDto })
    @ApiResponse({
        status: 201,
        description: 'Feedback submitted successfully.',
    })
    @ApiForbiddenResponse({ description: 'Only confirmed participants can submit feedback.' })
    @ApiBadRequestResponse({ description: 'Social not completed or invalid payload.' })
    submitFeedback(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: SubmitSocialFeedbackDto,
        @Req() request: SocialRequest,
    ) {
        const userId = request.user?.userId;
        if (!userId) {
            throw new UnauthorizedException('Unable to identify current user');
        }
        return this.socialService.submitFeedback(id, userId, dto);
    }

    @Get(':id/feedback/analytics')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Get feedback analytics',
        description: 'Retrieve aggregated ratings and comments for a completed social.',
    })
    @ApiParam({ name: 'id', description: 'Social id (UUID).' })
    @ApiResponse({
        status: 200,
        description: 'Feedback analytics retrieved successfully.',
    })
    @ApiNotFoundResponse({ description: 'Social not found.' })
    getFeedbackAnalytics(
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.socialService.getFeedbackAnalytics(id);
    }

    @Post('internal/query-by-player')
    @ApiSecurity('internal-service-token')
    @ApiOperation({
        summary: 'Query socials by player (internal)',
        description: 'Retrieves active socials of a player within date range.',
    })
    @ApiResponse({
        status: 200,
        description: 'Player socials retrieved successfully.',
    })
    @UseGuards(InternalServiceGuard)
    queryPlayerSocialsInternal(@Body() dto: QuerySocialsInternalDto) {
        return this.socialService.queryPlayerSocials(dto.userId, dto.startDate, dto.endDate);
    }
}
