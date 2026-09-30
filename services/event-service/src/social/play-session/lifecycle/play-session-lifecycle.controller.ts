import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { RequireSubscription } from "../../../guards/subscription.guard";
import { PlaySessionLifecycleService } from "./play-session-lifecycle.service";

type PlaySessionLifecycleRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags("Play Session Lifecycle")
@Controller("socials/:socialId/play-sessions/:sessionId")
@ApiBearerAuth("access-token")
export class PlaySessionLifecycleController {
  constructor(
    private readonly playSessionLifecycleService: PlaySessionLifecycleService
  ) {}

  // #region POST .../start

  @Post("start")
  @RequireSubscription('SOCIAL_HOST')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Start a play session",
    description:
      "Organizer-only. Transitions an ACTIVE play session to IN_PROGRESS and seeds a `PlaySessionParticipant` row for every CONFIRMED `SocialParticipant` of the parent social. Re-running is safe (the bulk insert uses `skipDuplicates`).",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  @ApiResponse({
    status: 200,
    description: "Play session is now IN_PROGRESS",
    schema: {
      example: {
        message: "Play session started",
        data: {
          session: {
            id: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
            socialId: "b5c1d2e3-f4a5-6b7c-8d9e-0f1a2b3c4d5e",
            status: "IN_PROGRESS",
            updatedAt: "2026-05-23T07:00:00.000Z",
          },
          seededParticipants: 4,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Play session is not in ACTIVE state.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiForbiddenResponse({
    description: "Caller is not an organizer of this social.",
  })
  @ApiNotFoundResponse({ description: "Social or play session not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  start(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Req() request: PlaySessionLifecycleRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.playSessionLifecycleService.start(
      socialId,
      sessionId,
      callerId
    );
  }

  // #endregion

  // #region POST .../complete

  @Post("complete")
  @RequireSubscription('SOCIAL_HOST')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Complete a play session",
    description:
      "Organizer-only. Transitions an IN_PROGRESS play session to COMPLETED. If every sibling session is now in {COMPLETED, CANCELLED}, the parent social also cascades to COMPLETED (unless it was already in a terminal state).",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  @ApiResponse({
    status: 200,
    description: "Play session is now COMPLETED",
    schema: {
      example: {
        message: "Play session completed",
        data: {
          session: {
            id: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
            status: "COMPLETED",
            updatedAt: "2026-05-23T09:00:00.000Z",
          },
          socialCascadedToCompleted: true,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Play session is not in IN_PROGRESS state.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiForbiddenResponse({
    description: "Caller is not an organizer of this social.",
  })
  @ApiNotFoundResponse({ description: "Social or play session not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  complete(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Req() request: PlaySessionLifecycleRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.playSessionLifecycleService.complete(
      socialId,
      sessionId,
      callerId
    );
  }

  // #endregion
}
