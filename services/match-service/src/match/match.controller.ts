import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";

import { MatchService } from "./match.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";

import { ConfirmResultDto } from "./dto/confirm-result.dto";
import { OverrideResultDto } from "./dto/override-result.dto";
import { StartMatchDto } from "./dto/start-match.dto";
import { MatchQueryDto } from "./dto/match-query.dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { InternalTokenGuard } from "../guards/internal-token.guard";
import { CreateMatchBatchDto } from "./dto/create-match-batch.dto";
import { QueryMatchesInternalDto } from "./dto/query-matches-internal.dto";
import { QueryMatchesBySessionsInternalDto } from "./dto/query-matches-by-sessions.dto";

@ApiTags("Matches")
@Controller("api/matches")
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  // ─── POST /api/matches ───────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Create a match",
    description:
      "Schedule a new match. For `CUSTOM` matches, the caller must include themselves in teamA or teamB, unless they are acting as the referee. Hosts creating `TOURNAMENT` or `SOCIAL` matches are exempt from this rule. " +
      "The created match starts in the SCHEDULED state and uses the body fields documented on CreateMatchDto.",
  })
  @ApiBody({ type: CreateMatchDto })
  @ApiResponse({
    status: 201,
    description: "Match created.",
    content: {
      "application/json": {
        example: {
          id: "e0000001-e000-4000-8000-000000000000",
          category: "CUSTOM",
          matchType: "DOUBLES",
          status: "SCHEDULED",
          scheduledAt: "2026-03-28T08:00:00.000Z",
          courtId: "c0010000-c001-4000-8000-000000010001",
          court: {
            id: "c0010000-c001-4000-8000-000000010001",
            name: "San 1",
            type: "INDOOR",
            status: "ACTIVE",
            centerId: "9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a",
            centerName: "PickleHub District 1",
            centerAddress: "123 Nguyen Hue, District 1, Ho Chi Minh City",
          },
          tournamentId: null,
          playSessionId: null,
          scoreA: 0,
          scoreB: 0,
          sets: null,
          winner: null,
          teamA: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              fullName: "Picklehub Seed User",
              avatarUrl:
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
              selfRating: 3.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              fullName: "Picklehub Player 1",
              avatarUrl:
                "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
              selfRating: 3.5,
            },
          ],
          teamB: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              fullName: "Picklehub Player 2",
              avatarUrl:
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
              selfRating: 4.0,
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              fullName: "Picklehub Player 3",
              avatarUrl:
                "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
              selfRating: 2.5,
            },
          ],
          refereeId: "22222222-2222-4222-8222-222222222222",
          referee: {
            id: "22222222-2222-4222-8222-222222222222",
            fullName: "Picklehub Seed Owner",
            avatarUrl:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            selfRating: 4.0,
          },
          confirmedByA: false,
          confirmedByB: false,
          confirmedByRef: false,
          startedAt: null,
          finishedAt: null,
          createdById: "11111111-1111-4111-8111-111111111111",
          createdBy: {
            id: "11111111-1111-4111-8111-111111111111",
            fullName: "Picklehub Seed User",
            avatarUrl:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
            selfRating: 3.5,
          },
          createdAt: "2026-03-20T10:15:00.000Z",
          updatedAt: "2026-03-20T10:15:00.000Z",
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreateMatchDto,
  ) {
    return this.matchService.createMatch(req.user?.sub ?? "", dto);
  }

  // ─── GET /api/matches ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: "List matches",
    description:
      "Return a paginated match list with optional filters. Query parameters are documented on MatchQueryDto.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated match list returned.",
    content: {
      "application/json": {
        example: {
          items: [
            {
              id: "e0000001-e000-4000-8000-000000000000",
              category: "CUSTOM",
              matchType: "PRACTICE",
              status: "LIVE",
              scheduledAt: "2026-03-28T08:00:00.000Z",
              courtId: "c0010000-c001-4000-8000-000000010001",
              court: {
                id: "c0010000-c001-4000-8000-000000010001",
                name: "San 1",
                type: "INDOOR",
                status: "ACTIVE",
                centerId: "9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a",
                centerName: "PickleHub District 1",
                centerAddress: "123 Nguyen Hue, District 1, Ho Chi Minh City",
              },
              tournamentId: null,
              playSessionId: null,
              scoreA: 2,
              scoreB: 1,
              sets: [
                [11, 5],
                [9, 11],
                [11, 8],
              ],
              winner: null,
              teamA: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  fullName: "Picklehub Seed User",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
                  selfRating: 3.5,
                },
                {
                  id: "33333333-3333-4333-8333-333333333333",
                  fullName: "Picklehub Player 1",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
                  selfRating: 3.5,
                },
              ],
              teamB: [
                {
                  id: "44444444-4444-4444-8444-444444444444",
                  fullName: "Picklehub Player 2",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
                  selfRating: 4.0,
                },
                {
                  id: "55555555-5555-4555-8555-555555555555",
                  fullName: "Picklehub Player 3",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
                  selfRating: 2.5,
                },
              ],
              refereeId: "22222222-2222-4222-8222-222222222222",
              referee: {
                id: "22222222-2222-4222-8222-222222222222",
                fullName: "Picklehub Seed Owner",
                avatarUrl:
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
                selfRating: 4.0,
              },
              confirmedByA: false,
              confirmedByB: false,
              confirmedByRef: false,
              startedAt: "2026-03-28T08:01:00.000Z",
              finishedAt: null,
              createdById: "11111111-1111-4111-8111-111111111111",
              createdBy: {
                id: "11111111-1111-4111-8111-111111111111",
                fullName: "Picklehub Seed User",
                avatarUrl:
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
                selfRating: 3.5,
              },
              createdAt: "2026-03-20T10:15:00.000Z",
              updatedAt: "2026-03-28T08:45:00.000Z",
            },
          ],
          meta: {
            total: 25,
            page: 1,
            limit: 10,
            totalPages: 3,
          },
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  listMatches(@Query() query: MatchQueryDto) {
    return this.matchService.listMatches(query);
  }

  // ─── GET /api/matches/my ─────────────────────────────────────────────────────

  @Get("my")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "List my matches",
    description:
      "Return a paginated list of matches for the currently authenticated user.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated match list returned.",
    content: {
      "application/json": {
        example: {
          items: [
            {
              id: "e0000001-e000-4000-8000-000000000000",
              category: "CUSTOM",
              matchType: "PRACTICE",
              status: "LIVE",
              scheduledAt: "2026-03-28T08:00:00.000Z",
              courtId: "c0010000-c001-4000-8000-000000010001",
              court: {
                id: "c0010000-c001-4000-8000-000000010001",
                name: "San 1",
                type: "INDOOR",
                status: "ACTIVE",
                centerId: "9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a",
                centerName: "PickleHub District 1",
                centerAddress: "123 Nguyen Hue, District 1, Ho Chi Minh City",
              },
              tournamentId: null,
              playSessionId: null,
              scoreA: 2,
              scoreB: 1,
              sets: [
                [11, 5],
                [9, 11],
                [11, 8],
              ],
              winner: null,
              teamA: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  fullName: "Picklehub Seed User",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
                  selfRating: 3.5,
                },
                {
                  id: "33333333-3333-4333-8333-333333333333",
                  fullName: "Picklehub Player 1",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
                  selfRating: 3.5,
                },
              ],
              teamB: [
                {
                  id: "44444444-4444-4444-8444-444444444444",
                  fullName: "Picklehub Player 2",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
                  selfRating: 4.0,
                },
                {
                  id: "55555555-5555-4555-8555-555555555555",
                  fullName: "Picklehub Player 3",
                  avatarUrl:
                    "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
                  selfRating: 2.5,
                },
              ],
              refereeId: "22222222-2222-4222-8222-222222222222",
              referee: {
                id: "22222222-2222-4222-8222-222222222222",
                fullName: "Picklehub Seed Owner",
                avatarUrl:
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
                selfRating: 4.0,
              },
              confirmedByA: false,
              confirmedByB: false,
              confirmedByRef: false,
              startedAt: "2026-03-28T08:01:00.000Z",
              finishedAt: null,
              createdById: "11111111-1111-4111-8111-111111111111",
              createdBy: {
                id: "11111111-1111-4111-8111-111111111111",
                fullName: "Picklehub Seed User",
                avatarUrl:
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
                selfRating: 3.5,
              },
              createdAt: "2026-03-20T10:15:00.000Z",
              updatedAt: "2026-03-28T08:45:00.000Z",
            },
          ],
          meta: {
            total: 25,
            page: 1,
            limit: 10,
            totalPages: 3,
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @HttpCode(HttpStatus.OK)
  listMyMatches(
    @Request() req: { user?: { sub?: string } },
    @Query() query: MatchQueryDto,
  ) {
    // Override the userId with the authenticated user
    return this.matchService.listMatches({ ...query, userId: req.user?.sub });
  }

  // ─── GET /api/matches/my/stats ───────────────────────────────────────────────

  @Get("my/stats")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get my match stats",
    description:
      "Calculate confirmed-match statistics for the currently authenticated user with optional filters.",
  })
  @ApiResponse({
    status: 200,
    description: "Match statistics returned.",
    content: {
      "application/json": {
        example: {
          totalMatches: 42,
          wins: 28,
          losses: 10,
          draws: 4,
          winRate: 67,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @HttpCode(HttpStatus.OK)
  getMyStats(
    @Request() req: { user?: { sub?: string } },
    @Query() query: MatchQueryDto,
  ) {
    return this.matchService.getMatchStats(req.user?.sub ?? "", query);
  }

  // ─── GET /api/matches/stats/:userId ─────────────────────────────────────────
  // IMPORTANT: This route must remain above GET /:id to prevent NestJS from
  // catching "stats/some-uuid" as the :id parameter.

  @Get("stats/:userId")
  @ApiOperation({
    summary: "Get user match stats",
    description:
      "Calculate confirmed-match statistics for a specific user with optional filters.",
  })
  @ApiParam({ name: "userId", description: "User UUID" })
  @ApiResponse({
    status: 200,
    description: "Match statistics returned.",
    content: {
      "application/json": {
        example: {
          totalMatches: 42,
          wins: 28,
          losses: 10,
          draws: 4,
          winRate: 67,
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  getStats(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: MatchQueryDto,
  ) {
    return this.matchService.getMatchStats(userId, query);
  }

  // ─── GET /api/matches/:id ────────────────────────────────────────────────────

  @Get(":id")
  @ApiOperation({
    summary: "Get match details",
    description:
      "Fetch the full match record, including teams, score, status, referee, and timestamps, by match UUID.",
  })
  @ApiParam({
    name: "id",
    description: "Match UUID.",
    example: "e0000001-e000-4000-8000-000000000000",
  })
  @ApiResponse({
    status: 200,
    description: "Match found and returned.",
    content: {
      "application/json": {
        example: {
          id: "e0000001-e000-4000-8000-000000000000",
          category: "CUSTOM",
          matchType: "PRACTICE",
          status: "PENDING_CONFIRM",
          scheduledAt: "2026-03-28T08:00:00.000Z",
          courtId: "c0010000-c001-4000-8000-000000010001",
          court: {
            id: "c0010000-c001-4000-8000-000000010001",
            name: "San 1",
            type: "INDOOR",
            status: "ACTIVE",
            centerId: "9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a",
            centerName: "PickleHub District 1",
            centerAddress: "123 Nguyen Hue, District 1, Ho Chi Minh City",
          },
          scoreA: 2,
          scoreB: 1,
          sets: [
            [11, 5],
            [9, 11],
            [11, 8],
          ],
          winner: null,
          teamA: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              fullName: "Picklehub Seed User",
              avatarUrl:
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
              selfRating: 3.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              fullName: "Picklehub Player 1",
              avatarUrl:
                "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
              selfRating: 3.5,
            },
          ],
          teamB: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              fullName: "Picklehub Player 2",
              avatarUrl:
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
              selfRating: 4.0,
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              fullName: "Picklehub Player 3",
              avatarUrl:
                "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
              selfRating: 2.5,
            },
          ],
          refereeId: "22222222-2222-4222-8222-222222222222",
          referee: {
            id: "22222222-2222-4222-8222-222222222222",
            fullName: "Picklehub Seed Owner",
            avatarUrl:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            selfRating: 4.0,
          },
          confirmedByA: true,
          confirmedByB: false,
          confirmedByRef: true,
          startedAt: "2026-03-28T08:01:00.000Z",
          finishedAt: null,
          createdById: "11111111-1111-4111-8111-111111111111",
          createdBy: {
            id: "11111111-1111-4111-8111-111111111111",
            fullName: "Picklehub Seed User",
            avatarUrl:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
            selfRating: 3.5,
          },
          createdAt: "2026-03-20T10:15:00.000Z",
          updatedAt: "2026-03-28T09:10:00.000Z",
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Match not found." })
  @HttpCode(HttpStatus.OK)
  getOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.matchService.getMatch(id);
  }

  // ─── PATCH /api/matches/:id ──────────────────────────────────────────────────

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Update match details",
    description:
      "Update a SCHEDULED match. Only the match creator can update the details.",
  })
  @ApiParam({
    name: "id",
    description: "Match UUID.",
    example: "e0000001-e000-4000-8000-000000000000",
  })
  @ApiBody({ type: UpdateMatchDto })
  @ApiResponse({ status: 200, description: "Match updated successfully." })
  @ApiResponse({
    status: 400,
    description: "Match is not in SCHEDULED state or validation failed.",
  })
  @ApiResponse({
    status: 403,
    description: "Only the creator can update the match.",
  })
  @ApiResponse({ status: 404, description: "Match not found." })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() req: { user?: { sub?: string } },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.matchService.updateMatch(req.user?.sub ?? "", id, dto);
  }

  // ─── PATCH /api/matches/:id/start ──────────────────────────────────────────

  @Patch(":id/start")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Start a match",
    description:
      "Transition a SCHEDULED match to LIVE. The caller must be one of the participants, the assigned referee, or the host of a TOURNAMENT/SOCIAL match.",
  })
  @ApiParam({
    name: "id",
    description: "Match UUID.",
    example: "e0000001-e000-4000-8000-000000000000",
  })
  @ApiResponse({
    status: 200,
    description: "Match is now LIVE.",
    content: {
      "application/json": {
        example: {
          id: "e0000001-e000-4000-8000-000000000000",
          category: "CUSTOM",
          matchType: "DOUBLES",
          status: "LIVE",
          scheduledAt: "2026-03-28T08:00:00.000Z",
          courtId: "c0010000-c001-4000-8000-000000010001",
          court: {
            id: "c0010000-c001-4000-8000-000000010001",
            name: "San 1",
            type: "INDOOR",
            status: "ACTIVE",
            centerId: "9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a",
            centerName: "PickleHub District 1",
            centerAddress: "123 Nguyen Hue, District 1, Ho Chi Minh City",
          },
          tournamentId: null,
          playSessionId: null,
          scoreA: 0,
          scoreB: 0,
          sets: null,
          winner: null,
          teamA: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              fullName: "Picklehub Seed User",
              avatarUrl:
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
              selfRating: 3.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              fullName: "Picklehub Player 1",
              avatarUrl:
                "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
              selfRating: 3.5,
            },
          ],
          teamB: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              fullName: "Picklehub Player 2",
              avatarUrl:
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
              selfRating: 4.0,
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              fullName: "Picklehub Player 3",
              avatarUrl:
                "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
              selfRating: 2.5,
            },
          ],
          refereeId: "22222222-2222-4222-8222-222222222222",
          referee: {
            id: "22222222-2222-4222-8222-222222222222",
            fullName: "Picklehub Seed Owner",
            avatarUrl:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            selfRating: 4.0,
          },
          confirmedByA: false,
          confirmedByB: false,
          confirmedByRef: false,
          startedAt: "2026-03-28T08:01:00.000Z",
          finishedAt: null,
          createdById: "11111111-1111-4111-8111-111111111111",
          createdBy: {
            id: "11111111-1111-4111-8111-111111111111",
            fullName: "Picklehub Seed User",
            avatarUrl:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
            selfRating: 3.5,
          },
          createdAt: "2026-03-20T10:15:00.000Z",
          updatedAt: "2026-03-28T08:01:00.000Z",
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Match is not in SCHEDULED state." })
  @ApiResponse({ status: 403, description: "Caller is not a participant." })
  @ApiResponse({ status: 404, description: "Match not found." })
  @HttpCode(HttpStatus.OK)
  start(
    @Request() req: { user?: { sub?: string } },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: StartMatchDto,
  ) {
    return this.matchService.startMatch(req.user?.sub ?? "", id, dto.firstServingPlayerId);
  }

  // ─── PATCH /api/matches/:id/confirm ─────────────────────────────────────────

  @Patch(":id/confirm")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Confirm match result",
    description:
      "Submit and confirm the final score of a match. \n\n" +
      "### Confirmation Logic:\n" +
      "- **With Referee or Host:** Only the assigned referee (or the creator of a TOURNAMENT/SOCIAL match) needs to confirm. They must provide the final score or explicitly declare a winner. The match immediately becomes `CONFIRMED`.\n" +
      "- **Without Referee (Self-Umpired):** One player from **Team A** AND one player from **Team B** must confirm.\n" +
      "  - The first team to confirm submits the score. The match enters the `PENDING_CONFIRM` state.\n" +
      "  - The second team fetches the match, sees the submitted score, and confirms. If they omit the score in their request, they accept the first team's score. If they submit a different score, the server will reject the request with a `400 Bad Request`.\n" +
      "  - Once both teams have confirmed, the match becomes `CONFIRMED`.\n\n" +
      "**Note:** The system automatically derives the `winner` from `scoreA` and `scoreB` if you do not explicitly provide it in the DTO.",
  })
  @ApiParam({
    name: "id",
    description: "Match UUID.",
    example: "e0000001-e000-4000-8000-000000000000",
  })
  @ApiBody({ type: ConfirmResultDto })
  @ApiResponse({
    status: 200,
    description:
      "Confirmation recorded. Returns PENDING_CONFIRM when waiting for other party, or CONFIRMED when all parties agree.",
    content: {
      "application/json": {
        example: {
          id: "e0000001-e000-4000-8000-000000000000",
          category: "CUSTOM",
          matchType: "DOUBLES",
          status: "CONFIRMED",
          scheduledAt: "2026-03-28T08:00:00.000Z",
          courtId: "c0010000-c001-4000-8000-000000010001",
          court: {
            id: "c0010000-c001-4000-8000-000000010001",
            name: "San 1",
            type: "INDOOR",
            status: "ACTIVE",
            centerId: "9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a",
            centerName: "PickleHub District 1",
            centerAddress: "123 Nguyen Hue, District 1, Ho Chi Minh City",
          },
          tournamentId: null,
          playSessionId: null,
          scoreA: 11,
          scoreB: 8,
          sets: [
            [11, 5],
            [9, 11],
            [11, 8],
          ],
          winner: "TEAM_A",
          teamA: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              fullName: "Picklehub Seed User",
              avatarUrl:
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
              selfRating: 3.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              fullName: "Picklehub Player 1",
              avatarUrl:
                "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
              selfRating: 3.5,
            },
          ],
          teamB: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              fullName: "Picklehub Player 2",
              avatarUrl:
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
              selfRating: 4.0,
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              fullName: "Picklehub Player 3",
              avatarUrl:
                "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
              selfRating: 2.5,
            },
          ],
          refereeId: "22222222-2222-4222-8222-222222222222",
          referee: {
            id: "22222222-2222-4222-8222-222222222222",
            fullName: "Picklehub Seed Owner",
            avatarUrl:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            selfRating: 4.0,
          },
          confirmedByA: true,
          confirmedByB: true,
          confirmedByRef: true,
          startedAt: "2026-03-28T08:01:00.000Z",
          finishedAt: "2026-03-28T09:10:00.000Z",
          createdById: "11111111-1111-4111-8111-111111111111",
          createdBy: {
            id: "11111111-1111-4111-8111-111111111111",
            fullName: "Picklehub Seed User",
            avatarUrl:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
            selfRating: 3.5,
          },
          createdAt: "2026-03-20T10:15:00.000Z",
          updatedAt: "2026-03-28T09:10:00.000Z",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Match is not in a confirmable state.",
  })
  @ApiResponse({ status: 403, description: "Caller is not a participant." })
  @ApiResponse({ status: 404, description: "Match not found." })
  @HttpCode(HttpStatus.OK)
  confirm(
    @Request() req: { user?: { sub?: string } },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfirmResultDto,
  ) {
    return this.matchService.confirmResult(req.user?.sub ?? "", id, dto);
  }

  // ─── PATCH /api/matches/:id/cancel ──────────────────────────────────────────

  @Patch(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Cancel a match",
    description:
      "Cancel a match before it is finalized. Only the match creator can cancel it, and CONFIRMED matches cannot be cancelled.",
  })
  @ApiParam({
    name: "id",
    description: "Match UUID.",
    example: "e0000001-e000-4000-8000-000000000000",
  })
  @ApiResponse({
    status: 200,
    description: "Match cancelled.",
    content: {
      "application/json": {
        example: {
          id: "e0000001-e000-4000-8000-000000000000",
          category: "CUSTOM",
          matchType: "DOUBLES",
          status: "CANCELLED",
          scheduledAt: "2026-03-28T08:00:00.000Z",
          courtId: "c0010000-c001-4000-8000-000000010001",
          court: {
            id: "c0010000-c001-4000-8000-000000010001",
            name: "San 1",
            type: "INDOOR",
            status: "ACTIVE",
            centerId: "9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a",
            centerName: "PickleHub District 1",
            centerAddress: "123 Nguyen Hue, District 1, Ho Chi Minh City",
          },
          tournamentId: null,
          playSessionId: null,
          scoreA: 0,
          scoreB: 0,
          sets: null,
          winner: null,
          teamA: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              fullName: "Picklehub Seed User",
              avatarUrl:
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
              selfRating: 3.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              fullName: "Picklehub Player 1",
              avatarUrl:
                "https://images.unsplash.com/photo-1599566150163-29194dcaad36",
              selfRating: 3.5,
            },
          ],
          teamB: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              fullName: "Picklehub Player 2",
              avatarUrl:
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
              selfRating: 4.0,
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              fullName: "Picklehub Player 3",
              avatarUrl:
                "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
              selfRating: 2.5,
            },
          ],
          refereeId: "22222222-2222-4222-8222-222222222222",
          referee: {
            id: "22222222-2222-4222-8222-222222222222",
            fullName: "Picklehub Seed Owner",
            avatarUrl:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            selfRating: 4.0,
          },
          confirmedByA: false,
          confirmedByB: false,
          confirmedByRef: false,
          startedAt: null,
          finishedAt: null,
          createdById: "11111111-1111-4111-8111-111111111111",
          createdBy: {
            id: "11111111-1111-4111-8111-111111111111",
            fullName: "Picklehub Seed User",
            avatarUrl:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
            selfRating: 3.5,
          },
          createdAt: "2026-03-20T10:15:00.000Z",
          updatedAt: "2026-03-28T07:55:00.000Z",
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Cannot cancel a CONFIRMED match." })
  @ApiResponse({ status: 403, description: "Only the creator can cancel." })
  @ApiResponse({ status: 404, description: "Match not found." })
  @HttpCode(HttpStatus.OK)
  cancel(
    @Request() req: { user?: { sub?: string } },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.matchService.cancelMatch(req.user?.sub ?? "", id);
  }

  // ─── POST /api/matches/internal/batch ────────────────────────────────────────

  @Post('internal/batch')
  @UseGuards(InternalTokenGuard)
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: '[Internal] Batch create matches',
    description:
      'Service-to-service only (event-service). Creates up to 20 matches atomically for a single play session. ' +
      'Secured by X-Internal-Service-Token header — not exposed to public clients.',
  })
  @ApiBody({ type: CreateMatchBatchDto })
  @ApiResponse({
    status: 201,
    description: 'Matches created.',
    content: {
      'application/json': {
        example: {
          created: 2,
          matches: [
            {
              id: 'e0000001-e000-4000-8000-000000000001',
              category: 'SOCIAL',
              matchType: 'DOUBLES',
              status: 'SCHEDULED',
              scheduledAt: '2026-05-23T11:00:00.000Z',
              courtId: 'c0010000-c001-4000-8000-000000010001',
              playSessionId: '550e8400-e29b-41d4-a716-446655440008',
              teamA: ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'],
              teamB: ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error on one or more match items.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid internal service token.' })
  @HttpCode(HttpStatus.CREATED)
  createBatch(
    @Body() dto: CreateMatchBatchDto,
  ) {
    return this.matchService.createMatchBatch(dto.createdById, dto);
  }

  @Post('internal/query-by-player')
  @UseGuards(InternalTokenGuard)
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: '[Internal] Query matches by player',
    description: 'Retrieves non-cancelled matches of a player within date range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Player matches retrieved successfully.',
  })
  queryPlayerMatchesInternal(@Body() dto: QueryMatchesInternalDto) {
    return this.matchService.queryPlayerMatches(dto.userId, dto.startDate, dto.endDate);
  }

  @Post('internal/query-by-sessions')
  @UseGuards(InternalTokenGuard)
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: '[Internal] Query matches by play sessions',
    description: 'Retrieves matches associated with a batch of play session IDs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Play session matches retrieved successfully.',
  })
  queryMatchesBySessionsInternal(@Body() dto: QueryMatchesBySessionsInternalDto) {
    return this.matchService.queryMatchesByPlaySessions(dto);
  }

  @Patch('internal/:id/override-result')
  @UseGuards(InternalTokenGuard)
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: '[Internal] Override match result',
    description: 'Allows tournament-service admin to manually overwrite a match score and status.',
  })
  overrideMatchResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideResultDto,
  ) {
    return this.matchService.overrideMatchResult(id, dto);
  }

  @Post('internal/fixtures/:id/schedule-unsync')
  @UseGuards(InternalTokenGuard)
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: '[Internal] Unsync match schedule',
    description: 'Clears courtName and sets scheduled time to null when a booking is deleted or unlinked.',
  })
  unsyncMatchSchedule(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchService.unsyncMatchSchedule(id);
  }
}
