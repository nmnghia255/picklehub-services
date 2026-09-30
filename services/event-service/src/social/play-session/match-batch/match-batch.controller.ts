import {
  BadRequestException,
  Body,
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
  ApiBody,
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
import { SuggestBatchDto } from "./dto/suggest-batch.dto";
import { CommitBatchDto } from "./dto/commit-batch.dto";
import { MatchBatchService } from "./match-batch.service";

type MatchBatchRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags("Play Session Match Batches")
@Controller("socials/:socialId/play-sessions/:sessionId/match-batches")
@ApiBearerAuth("access-token")
export class MatchBatchController {
  constructor(private readonly matchBatchService: MatchBatchService) {}

  // #region POST .../suggest

  @Post("suggest")
  @RequireSubscription('SOCIAL_HOST')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Suggest a match batch (stateless)",
    description:
      "Organizer-only. Returns a proposed pairing for all rounds in the session using the session's own startTime and booking duration, " +
      "eligible booked courts, and confirmed real-user participants. " +
      "Inputs: singlesCount, doublesCount, roundDurationMins, excludeParticipantIds (optional bench list). " +
      "The endpoint persists nothing — call POST .../commit to persist after the host edits the result.<br/><br/>" +
      "<b>Test Account:</b> `seed-user@picklehub.com` / `Picklehub123!`<br/>" +
      "<b>Social ID:</b> `8a0c173f-e79c-49a8-b67c-c4260db7ffa0`<br/>" +
      "<b>Play Session IDs:</b> <br/>" +
      "`e1111111-1111-4111-8111-111111111111` (Session 1)<br/>" +
      "`e2222222-2222-4222-8222-222222222222` (Session 2)<br/>" +
      "`e3333333-3333-4333-8333-333333333333` (Session 3)<br/>" +
      "`e4444444-4444-4444-8444-444444444444` (Session 4)<br/>" +
      "`e5555555-5555-4555-8555-555555555555` (Session 5)",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  @ApiBody({ type: SuggestBatchDto })
  @ApiResponse({
    status: 200,
    description: "Match batch suggested",
    schema: {
      example: {
        message: "Match batch suggested",
        data: {
          sessionStartTime: "2026-05-23T11:00:00.000Z",
          rounds: [
            {
              roundIndex: 0,
              scheduledAt: "2026-05-23T11:00:00.000Z",
              availableCourts: [
                {
                  courtNumber: 1,
                  courtId: "c0010000-c001-4000-8000-000000010001",
                  courtName: "San 1",
                  bookingId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                },
                {
                  courtNumber: 2,
                  courtId: "c0020000-c002-4000-8000-000000020002",
                  courtName: "San 2",
                  bookingId: "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e",
                },
              ],
              matches: [
                {
                  courtNumber: 1,
                  courtId: "c0010000-c001-4000-8000-000000010001",
                  courtName: "San 1",
                  bookingId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                  scheduledAt: "2026-05-23T11:00:00.000Z",
                  matchType: "DOUBLES",
                  teamA: [
                    {
                      participantId: "9b8e1d77-21d7-49a8-a4d4-3eee5d2b04ff",
                      userId: "f326626d-8604-4134-9e84-1e0e8bb35f60",
                      user: {
                        id: "f326626d-8604-4134-9e84-1e0e8bb35f60",
                        fullName: "Picklehub Player 1",
                        avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
                        gender: "MALE",
                        selfRating: 3.5,
                      },
                    },
                    {
                      participantId: "7c2a4b6d-8e0f-1a3b-5c7d-9e0f1a3b5c7d",
                      userId: "0b2a4b6d-8e0f-1a3b-5c7d-9e0f1a3b5c7d",
                      user: {
                        id: "0b2a4b6d-8e0f-1a3b-5c7d-9e0f1a3b5c7d",
                        fullName: "Social Participant 04",
                        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
                        gender: "MALE",
                        selfRating: 3.5,
                      },
                    },
                  ],
                  teamB: [
                    {
                      participantId: "8d3b5c7e-9f1a-2b4d-6e8f-0a1b3d5e7f9a",
                      userId: "1c3d5e7f-9a0b-2c4d-6e8f-0a1b3c5d7e9f",
                      user: {
                        id: "1c3d5e7f-9a0b-2c4d-6e8f-0a1b3c5d7e9f",
                        fullName: "Picklehub Player 2",
                        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
                        gender: "FEMALE",
                        selfRating: 3.0,
                      },
                    },
                    {
                      participantId: "9e4c6d8f-0a1b-3c5d-7e9f-1a2b4c6d8e0f",
                      userId: "2d4e6f8a-0b1c-3d5e-7f9a-1b2c4d6e8f0a",
                      user: {
                        id: "2d4e6f8a-0b1c-3d5e-7f9a-1b2c4d6e8f0a",
                        fullName: "Social Participant 05",
                        avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61",
                        gender: "FEMALE",
                        selfRating: 3.0,
                      },
                    },
                  ],
                  isUnrated: false,
                },
              ],
              waitingParticipants: [
                {
                  participantId: "bc6233f4-9d9c-4754-862f-007a72009033",
                  userId: "3c5e7f9a-1b2d-4e6f-8a0b-1c3d5e7f9a0b",
                  user: {
                    id: "3c5e7f9a-1b2d-4e6f-8a0b-1c3d5e7f9a0b",
                    fullName: "Waiting Player 1",
                    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9",
                    gender: "MALE",
                    selfRating: 3.0,
                  },
                }
              ],
            }
          ]
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "No booked courts found for the session, " +
      "not enough eligible participants for the requested match counts, " +
      "or requested matches exceed available courts in any round.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiForbiddenResponse({
    description: "Caller is not an organizer of this social.",
  })
  @ApiNotFoundResponse({ description: "Social or play session not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  suggest(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Body() dto: SuggestBatchDto,
    @Req() request: MatchBatchRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.matchBatchService.suggest(socialId, sessionId, callerId, dto);
  }

  // #endregion

  // #region POST .../commit

  @Post("commit")
  @RequireSubscription('SOCIAL_HOST')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Commit a match batch (persists matches)",
    description:
      "Organizer-only. Accepts the final list of matches as confirmed by the host " +
      "(after any manual edits to the suggest response on the frontend) and persists them " +
      "atomically in match-service. " +
      "Intended flow: call suggest → host edits pairings → call commit.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "sessionId", description: "Play session id (UUID)." })
  @ApiBody({ type: CommitBatchDto })
  @ApiResponse({
    status: 201,
    description: "Match batch committed",
    schema: {
      example: {
        message: "Match batch committed",
        data: {
          created: 2,
          matches: [
            {
              id: "e0000001-e000-4000-8000-000000000001",
              category: "SOCIAL",
              matchType: "DOUBLES",
              status: "SCHEDULED",
              scheduledAt: "2026-05-23T11:00:00.000Z",
              courtId: "c0010000-c001-4000-8000-000000010001",
              playSessionId: "550e8400-e29b-41d4-a716-446655440008",
              teamA: [{ id: "11111111-1111-4111-8111-111111111111", name: "Player A" }],
              teamB: [{ id: "44444444-4444-4444-8444-444444444444", name: "Player B" }],
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "Match-service rejected one or more matches (e.g. wrong team sizes, duplicate referee).",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiForbiddenResponse({ description: "Caller is not an organizer of this social." })
  @ApiNotFoundResponse({ description: "Social or play session not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  commit(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CommitBatchDto,
    @Req() request: MatchBatchRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.matchBatchService.commit(socialId, sessionId, callerId, dto);
  }

  // #endregion
}
