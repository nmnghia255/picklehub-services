import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";
import { AddLiveGuestDto } from "./dto/add-live-guest.dto";
import { ListPlaySessionParticipantsQueryDto } from "./dto/list-play-session-participants.query.dto";
import { PlaySessionParticipantService } from "./play-session-participant.service";

type PlaySessionParticipantRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags("Play Session Participants")
@Controller("socials/:socialId/play-sessions/:sessionId")
@ApiBearerAuth("access-token")
export class PlaySessionParticipantController {
  constructor(
    private readonly playSessionParticipantService: PlaySessionParticipantService
  ) {}

  // #region GET .../participants

  @Get("participants")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "List play session participants",
    description:
      "Returns every PlaySessionParticipant row of a session — real users AND live guests — ordered by joinedAt DESC. Filter via `status` query.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  @ApiResponse({
    status: 200,
    description: "Play session participants fetched",
    schema: {
      example: {
        message: "Play session participants fetched",
        data: [
          {
            id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            playSessionId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
            userId: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
            status: "CONFIRMED",
            isGuest: false,
            guestName: null,
            skillLevel: null,
            joinedAt: "2026-05-23T07:00:00.000Z",
            isHost: false,
            user: {
              id: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
              name: "Jane Doe",
              email: "jane.doe@example.com",
              avatarUrl: "https://example.com/avatar.jpg",
            },
          },
          {
            id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            playSessionId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
            userId: null,
            status: "CONFIRMED",
            isGuest: true,
            guestName: "Walk-up Friend",
            skillLevel: "3.00",
            joinedAt: "2026-05-23T07:35:00.000Z",
            isHost: false,
            user: null,
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiNotFoundResponse({ description: "Social or play session not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  list(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Query() query: ListPlaySessionParticipantsQueryDto
  ) {
    return this.playSessionParticipantService.list(socialId, sessionId, query);
  }

  // #endregion

  // #region POST .../join

  @Post("join")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Join this play session (self)",
    description:
      "Adds the caller to the play session's attendance roster. Implicitly joins the caller as a CONFIRMED participant of the parent social if not already joined. Permitted while the session is ACTIVE or IN_PROGRESS (late arrivals OK); 400 once it's COMPLETED or CANCELLED. A previously-CANCELLED PSP row gets reactivated; otherwise a fresh row is created.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  @ApiResponse({
    status: 200,
    description: "Joined the play session",
    schema: {
      example: {
        message: "Joined play session",
        data: {
          id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          playSessionId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
          userId: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
          status: "CONFIRMED",
          isHost: false,
          joinedAt: "2026-05-23T07:35:00.000Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "Session is not in a joinable status (must be ACTIVE or IN_PROGRESS).",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiNotFoundResponse({ description: "Social or play session not found." })
  @ApiConflictResponse({
    description:
      "Caller is already an active participant of this play session.",
  })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  join(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Req() request: PlaySessionParticipantRequest
  ) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.playSessionParticipantService.joinAsMe(
      socialId,
      sessionId,
      userId
    );
  }

  // #endregion

  // #region DELETE .../participants/me

  @Delete("participants/me")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Leave this play session (self)",
    description:
      "Sets the caller's PSP row to CANCELLED. Allowed while the session is ACTIVE or IN_PROGRESS; rejected once it's COMPLETED or CANCELLED.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  @ApiResponse({
    status: 200,
    description: "Left the play session",
    schema: {
      example: {
        message: "Left play session",
        data: {
          id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          playSessionId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
          userId: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
          status: "CANCELLED",
          isHost: false,
          joinedAt: "2026-05-23T07:35:00.000Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "Session is not in a joinable status, or caller already cancelled.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiNotFoundResponse({
    description: "Social, play session, or caller PSP row not found.",
  })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  leave(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Req() request: PlaySessionParticipantRequest
  ) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.playSessionParticipantService.leaveAsMe(
      socialId,
      sessionId,
      userId
    );
  }

  // #endregion

  // #region POST .../guests

  // @Post("guests")
  // @HttpCode(200)
  // @UseGuards(JwtAuthGuard)
  // @ApiOperation({
  //   summary: "Add a live (walk-up) guest to this play session",
  //   description:
  //     "Organizer-only. Inserts a PSP row with `isGuest=true`, no userId, the supplied `guestName`, and optional `skillLevel`. Allowed while the session is ACTIVE or IN_PROGRESS — typically used mid-session for someone who shows up at the court.",
  // })
  // @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  // @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  // @ApiBody({ type: AddLiveGuestDto })
  // @ApiResponse({
  //   status: 200,
  //   description: "Live guest added",
  //   schema: {
  //     example: {
  //       message: "Live guest added",
  //       data: {
  //         id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  //         playSessionId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
  //         userId: null,
  //         status: "CONFIRMED",
  //         isGuest: true,
  //         guestName: "Walk-up Friend",
  //         skillLevel: "3.00",
  //       },
  //     },
  //   },
  // })
  // @ApiBadRequestResponse({
  //   description:
  //     "Session is not in a joinable status, or guestName missing/too long.",
  // })
  // @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  // @ApiForbiddenResponse({
  //   description: "Caller is not an organizer of this social.",
  // })
  // @ApiNotFoundResponse({ description: "Social or play session not found." })
  // @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  // addGuest(
  //   @Param("socialId", new ParseUUIDPipe()) socialId: string,
  //   @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
  //   @Body() dto: AddLiveGuestDto,
  //   @Req() request: PlaySessionParticipantRequest
  // ) {
  //   const callerId = request.user?.userId;
  //   if (!callerId) {
  //     throw new BadRequestException("Missing user identity");
  //   }
  //   return this.playSessionParticipantService.addLiveGuest(
  //     socialId,
  //     sessionId,
  //     callerId,
  //     dto
  //   );
  // }

  // #endregion

  // #region DELETE .../guests/:participantId

  // @Delete("guests/:participantId")
  // @HttpCode(200)
  // @UseGuards(JwtAuthGuard)
  // @ApiOperation({
  //   summary: "Remove a live guest from this play session",
  //   description:
  //     "Organizer-only. Soft-cancels the guest's PSP row. 400 if the target is a real user (use the self-leave or social-kick endpoints instead).",
  // })
  // @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  // @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  // @ApiParam({
  //   name: "participantId",
  //   description: "PlaySessionParticipant row id (UUID) of the guest to remove.",
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: "Live guest removed",
  //   schema: {
  //     example: {
  //       message: "Live guest removed",
  //       data: {
  //         id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  //         status: "CANCELLED",
  //         isGuest: true,
  //         guestName: "Walk-up Friend",
  //       },
  //     },
  //   },
  // })
  // @ApiBadRequestResponse({
  //   description:
  //     "Session not joinable, target is a real user (not a guest), or already cancelled.",
  // })
  // @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  // @ApiForbiddenResponse({
  //   description: "Caller is not an organizer of this social.",
  // })
  // @ApiNotFoundResponse({
  //   description: "Social, play session, or participant not found.",
  // })
  // @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  // removeGuest(
  //   @Param("socialId", new ParseUUIDPipe()) socialId: string,
  //   @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
  //   @Param("participantId", new ParseUUIDPipe()) participantId: string,
  //   @Req() request: PlaySessionParticipantRequest
  // ) {
  //   const callerId = request.user?.userId;
  //   if (!callerId) {
  //     throw new BadRequestException("Missing user identity");
  //   }
  //   return this.playSessionParticipantService.removeLiveGuest(
  //     socialId,
  //     sessionId,
  //     participantId,
  //     callerId
  //   );
  // }

  // #endregion
}
