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
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { ListSocialParticipantsQueryDto } from "./dto/list-social-participants.query.dto";
import { UpdateSocialParticipantStatusDto } from "./dto/update-social-participant-status.dto";
import { SocialParticipantService } from "./social-participant.service";
import { PaySocialDto } from "./dto/pay-social.dto";
import { VerifySocialPaymentDto } from "./dto/verify-payment.dto";
import { RefundSocialPaymentDto } from "./dto/refund-payment.dto";
import { JoinSocialDto } from "./dto/join-social.dto";

type SocialParticipantRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags("Social Participants")
@Controller("socials/:socialId")
@ApiBearerAuth("access-token")
export class SocialParticipantController {
  constructor(
    private readonly socialParticipantService: SocialParticipantService
  ) { }

  // #region GET /socials/:socialId/participants

  @Get("participants")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "List social participants",
    description:
      "Returns participants of a social ordered by joinedAt DESC. Use the status query to filter; default is ALL (includes CANCELLED).",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiResponse({
    status: 200,
    description:
      "Social participants fetched.\n\n" +
      "**Participant Payment Statuses (`paymentStatus`):**\n" +
      "- `UNPAID`: Player has not paid anything toward their totalFee yet.\n" +
      "- `PARTIALLY_PAID`: Player paid some amount, but less than their totalFee.\n" +
      "- `PAID`: Player paid exactly their totalFee.\n" +
      "- `OVERPAID`: Player paid more than their totalFee.\n" +
      "- `REFUNDED`: Host processed refund / returned all paid amount.\n\n" +
      "**Payment Transaction Statuses (`payments.status`):**\n" +
      "- `PENDING_REVIEW`: Awaiting host verification.\n" +
      "- `CONFIRMED`: Verified and approved by host.\n" +
      "- `REJECTED`: Rejected/declined by host.",
    schema: {
      example: {
        message: "Social participants fetched",
        data: [
          {
            id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            socialId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
            userId: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
            status: "CONFIRMED",
            totalFee: 0,
            amountPaid: 0,
            amountRefunded: 0,
            amountDue: 0,
            amountOverpaid: 0,
            isFullPackage: true,
            paymentStatus: "UNPAID",
            joinedAt: "2026-04-20T06:58:00.000Z",
            isHost: true,
            user: {
              id: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
              name: "Alice Nguyen",
              email: "alice@example.com",
              avatarUrl: "https://example.com/avatar1.jpg",
            },
            payments: [
              {
                id: "e5f67890-abcd-ef12-3456-7890abcdef12",
                socialParticipantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                amount: 100000,
                receiptUrl: "https://example.com/receipt.jpg",
                status: "PAID",
                transactionType: "PAYMENT",
                createdById: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
                verifiedById: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
                createdAt: "2026-04-20T07:00:00.000Z",
                updatedAt: "2026-04-20T07:05:00.000Z",
              }
            ],
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid social id or status filter." })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiNotFoundResponse({ description: "Social not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  list(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Query() query: ListSocialParticipantsQueryDto
  ) {
    return this.socialParticipantService.list(socialId, query);
  }

  // #endregion

  // #region PATCH /socials/:socialId/participants/:participantId/approve

  @Patch("participants/:participantId/approve")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Approve a WAITLISTED / ON_HOLD participant",
    description:
      "Organizer-only. Promotes the target participant to CONFIRMED, atomically incrementing joinedCount. " +
      "Refuses if the social is already at capacity.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({
    name: "participantId",
    description: "SocialParticipant row id (UUID).",
  })
  @ApiResponse({
    status: 200,
    description: "Participant approved",
    schema: {
      example: {
        message: "Participant approved",
        data: {
          id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          socialId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
          userId: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
          status: "CONFIRMED",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "Participant is not WAITLISTED/ON_HOLD, or social is at full capacity.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiForbiddenResponse({
    description: "Caller is not an organizer of this social.",
  })
  @ApiNotFoundResponse({ description: "Social or participant not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  approve(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("participantId", new ParseUUIDPipe()) participantId: string,
    @Req() request: SocialParticipantRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.socialParticipantService.approve(
      socialId,
      participantId,
      callerId
    );
  }

  // #endregion

  // #region PATCH /socials/:socialId/participants/:participantId/status

  @Patch("participants/:participantId/status")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Manually set a participant status",
    description:
      "Organizer-only. Sets the target participant to the supplied status. " +
      "Transitioning into CONFIRMED requires an available slot; transitioning out of CONFIRMED frees a slot and may auto-promote the oldest WAITLISTED participant.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({
    name: "participantId",
    description: "SocialParticipant row id (UUID).",
  })
  @ApiBody({ type: UpdateSocialParticipantStatusDto })
  @ApiResponse({
    status: 200,
    description: "Status updated",
    schema: {
      example: {
        message: "Participant status updated",
        data: {
          id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          socialId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
          userId: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
          status: "ON_HOLD",
          promotedUserId: "0bdc2f56-85fb-4495-a7dd-653ddd5f6cb5",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Invalid target status, host participant, or capacity full.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiForbiddenResponse({
    description: "Caller is not an organizer of this social.",
  })
  @ApiNotFoundResponse({ description: "Social or participant not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  updateStatus(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("participantId", new ParseUUIDPipe()) participantId: string,
    @Body() dto: UpdateSocialParticipantStatusDto,
    @Req() request: SocialParticipantRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.socialParticipantService.updateStatus(
      socialId,
      participantId,
      callerId,
      dto
    );
  }

  // #endregion

  // #region DELETE /socials/:socialId/participants/:participantId

  @Delete("participants/:participantId")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Kick a participant",
    description:
      "Organizer-only. Sets the target participant to CANCELLED. " +
      "If the kicked row was CONFIRMED, frees the slot and auto-promotes the oldest WAITLISTED participant. " +
      "Best-effort in-app notification is sent to the kicked user (guests skipped).",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({
    name: "participantId",
    description: "SocialParticipant row id (UUID).",
  })
  @ApiResponse({
    status: 200,
    description: "Participant removed",
    schema: {
      example: {
        message: "Participant removed",
        data: {
          socialId: "3a0c173f-e79c-49a8-b67c-c4260db7ff89",
          participantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          promotedUserId: "0bdc2f56-85fb-4495-a7dd-653ddd5f6cb5",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Target is the host, already cancelled, or invalid id.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  @ApiForbiddenResponse({
    description: "Caller is not an organizer of this social.",
  })
  @ApiNotFoundResponse({ description: "Social or participant not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected server error." })
  kick(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("participantId", new ParseUUIDPipe()) participantId: string,
    @Req() request: SocialParticipantRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    const callerLabel = request.user?.email ?? "An organizer";
    return this.socialParticipantService.kick(
      socialId,
      participantId,
      callerId,
      callerLabel
    );
  }

  // #endregion

  // #region POST /socials/:socialId/participants/me/pay

  @Post("participants/me/pay")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Submit payment",
    description: "Allows a participant to submit a payment amount and receipt URL.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiBody({ type: PaySocialDto })
  @ApiResponse({
    status: 201,
    description: "Payment submitted successfully",
    schema: {
      example: {
        message: "Payment submitted successfully, waiting for verification",
        data: {
          id: "e5f67890-abcd-ef12-3456-7890abcdef12",
          socialParticipantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          amount: 100000,
          receiptUrl: "https://example.com/receipt.jpg",
          status: "PENDING_REVIEW",
          transactionType: "PAYMENT",
          createdById: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
          createdAt: "2026-04-20T07:00:00.000Z",
          updatedAt: "2026-04-20T07:00:00.000Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid payload or not a participant." })
  @ApiUnauthorizedResponse({ description: "Missing/invalid JWT." })
  pay(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Body() dto: PaySocialDto,
    @Req() request: SocialParticipantRequest
  ) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.socialParticipantService.pay(socialId, userId, dto);
  }

  // #endregion

  // #region PATCH /socials/:socialId/participants/:participantId/verify

  @Patch("participants/:participantId/verify")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Verify participant payment",
    description: "Organizer-only. Verify or reject a specific payment transaction submitted by a participant.",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "participantId", description: "Participant id (UUID)." })
  @ApiBody({ type: VerifySocialPaymentDto })
  @ApiResponse({
    status: 200,
    description: "Payment verified/rejected successfully",
    schema: {
      example: {
        message: "Payment transaction verified successfully as CONFIRMED",
        data: {
          id: "e5f67890-abcd-ef12-3456-7890abcdef12",
          socialParticipantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          amount: 100000,
          receiptUrl: "https://example.com/receipt.jpg",
          status: "CONFIRMED",
          transactionType: "PAYMENT",
          createdById: "6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47",
          verifiedById: "f326626d-8604-4134-9e84-1e0e8bb35f60",
          createdAt: "2026-04-20T07:00:00.000Z",
          updatedAt: "2026-04-20T07:15:00.000Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiForbiddenResponse({ description: "Caller is not an organizer of this social." })
  @ApiNotFoundResponse({ description: "Social, participant, or payment not found." })
  verifyPayment(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("participantId", new ParseUUIDPipe()) participantId: string,
    @Body() dto: VerifySocialPaymentDto,
    @Req() request: SocialParticipantRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.socialParticipantService.verify(socialId, participantId, callerId, dto);
  }

  // #endregion

  // #region POST /socials/:socialId/participants/:participantId/refund

  @Post("participants/:participantId/refund")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Refund participant payment",
    description: "Organizer-only. Process a refund for a participant (creates a negative payment record and updates totals).",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "participantId", description: "Participant id (UUID)." })
  @ApiBody({ type: RefundSocialPaymentDto })
  @ApiResponse({
    status: 201,
    description: "Refund processed successfully",
    schema: {
      example: {
        message: "Refund processed successfully",
        data: {
          id: "r1e2f3u4-n5d6-7890-abcd-ef1234567890",
          socialParticipantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          amount: -50000,
          receiptUrl: null,
          status: "CONFIRMED",
          transactionType: "REFUND",
          createdById: "f326626d-8604-4134-9e84-1e0e8bb35f60",
          verifiedById: "f326626d-8604-4134-9e84-1e0e8bb35f60",
          createdAt: "2026-04-20T08:00:00.000Z",
          updatedAt: "2026-04-20T08:00:00.000Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiForbiddenResponse({ description: "Caller is not an organizer of this social." })
  @ApiNotFoundResponse({ description: "Social or participant not found." })
  refundPayment(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("participantId", new ParseUUIDPipe()) participantId: string,
    @Body() dto: RefundSocialPaymentDto,
    @Req() request: SocialParticipantRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.socialParticipantService.refund(socialId, participantId, callerId, dto);
  }

  // #endregion

  // #region POST /socials/:socialId/participants/:participantId/record-payment

  @Post("participants/:participantId/record-payment")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Record participant direct payment",
    description: "Organizer-only. Record a cash/direct payment for a participant (creates a CONFIRMED payment record and updates totals).",
  })
  @ApiParam({ name: "socialId", description: "Social id (UUID)." })
  @ApiParam({ name: "participantId", description: "Participant id (UUID)." })
  @ApiBody({ type: PaySocialDto })
  @ApiResponse({
    status: 201,
    description: "Direct payment recorded successfully",
    schema: {
      example: {
        message: "Direct payment recorded successfully",
        data: {
          id: "d1i2r3e4-c5t6-7890-abcd-ef1234567890",
          socialParticipantId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          amount: 150000,
          receiptUrl: null,
          status: "CONFIRMED",
          transactionType: "PAYMENT",
          createdById: "f326626d-8604-4134-9e84-1e0e8bb35f60",
          verifiedById: "f326626d-8604-4134-9e84-1e0e8bb35f60",
          createdAt: "2026-04-20T09:00:00.000Z",
          updatedAt: "2026-04-20T09:00:00.000Z",
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiForbiddenResponse({ description: "Caller is not an organizer of this social." })
  @ApiNotFoundResponse({ description: "Social or participant not found." })
  recordDirectPayment(
    @Param("socialId", new ParseUUIDPipe()) socialId: string,
    @Param("participantId", new ParseUUIDPipe()) participantId: string,
    @Body() dto: PaySocialDto,
    @Req() request: SocialParticipantRequest
  ) {
    const callerId = request.user?.userId;
    if (!callerId) {
      throw new BadRequestException("Missing user identity");
    }
    return this.socialParticipantService.recordDirectPayment(socialId, participantId, callerId, dto);
  }

  // #endregion
}
