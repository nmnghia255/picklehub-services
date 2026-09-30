import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrivateBookingService } from './private-booking.service';
import { CreatePrivateBookingDto } from './dto/create-private-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { UploadBookingProofDto } from './dto/upload-booking-proof.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateSessionLocationDto } from '../common/dto/update-session-location.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequireSubscription } from '../guards/subscription.guard';

// ─── Shared Swagger example objects ───────────────────────────────────────────

const BOOKING_EXAMPLE = {
  id: 'a1000001-a100-4000-8000-000000000001',
  coachProfileId: 'c0000001-c000-4000-8000-000000000001',
  learnerId: 'a0000010-a000-4000-8000-000000000010',
  sessionAt: '2026-07-20T09:00:00.000Z',
  durationMinutes: 60,
  priceVnd: 300000,
  status: 'PENDING_CONFIRMATION',
  paymentStatus: null, // null until the coach confirms — payment is not relevant yet
  learnerNote: 'Tôi muốn cải thiện kỹ thuật serve và dinking.',
  coachNote: null,
  cancelReason: null,
  paymentProofUrl: null,
  proofUploadedAt: null,
  settledAt: null,
  completedAt: null,
  createdAt: '2026-07-10T08:00:00.000Z',
  updatedAt: '2026-07-10T08:00:00.000Z',
  learnerProfile: {
    id: 'a0000010-a000-4000-8000-000000000010',
    name: 'Learner One',
    email: 'learner1@example.com',
    role: 'USER',
    avatarUrl: 'https://cdn.picklehub.vn/avatars/learner1.jpg',
  },
};

const BOOKING_WITH_COACH_EXAMPLE = {
  ...BOOKING_EXAMPLE,
  coachProfile: {
    id: 'c0000001-c000-4000-8000-000000000001',
    displayName: 'Nguyễn Văn Coach',
    avatarUrl: 'https://cdn.picklehub.vn/avatars/coach1.jpg',
    verificationStatus: 'VERIFIED',
    locationCity: 'Hà Nội',
    hourlyRateVnd: 300000,
    paymentAccountName: 'Nguyen Van Coach',
    paymentAccountNumber: '0123456789',
    paymentBankName: 'Techcombank',
    paymentQrUrl: 'https://cdn.picklehub.vn/qr/coach1.png',
  },
};

const BOOKING_CONFIRMED_EXAMPLE = {
  ...BOOKING_WITH_COACH_EXAMPLE,
  status: 'CONFIRMED',
  paymentStatus: 'PENDING_PROOF', // set by the coach on confirmation
  coachNote: 'Xác nhận buổi tập. Vui lòng chuyển khoản và gửi minh chứng.',
};

// ─────────────────────────────────────
//  Learner endpoints: /api/coaches/:coachId/bookings & /api/learner/bookings
// ─────────────────────────────────────

@ApiTags('Private Bookings — Learner Actions')
@Controller()
export class LearnerBookingController {
  constructor(private readonly bookingService: PrivateBookingService) {}

  @Post('api/coaches/:coachId/bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) Request a 1-on-1 private session',
    description:
      'Creates a private booking request for a specific ACTIVE coach. The booking starts as **PENDING_CONFIRMATION** — the coach must confirm it before payment can proceed.\n\n' +
      '**Price is auto-calculated and snapshotted** from `coach.hourlyRateVnd × (durationMinutes / 60)`, rounded to the nearest 1,000 VND.\n\n' +
      '```\n' +
      'priceVnd = round((durationMinutes / 60) × hourlyRateVnd / 1000) × 1000\n' +
      'Example: 90 min × 500,000 VND/h = 750,000 VND\n' +
      '```\n\n' +
      '**Returns 400** if the coach has not set an `hourlyRateVnd`. **Returns 404** if the coach is not ACTIVE.\n\n' +
      '---\n\n' +
      '## Phase 2B — Private Booking Integration Guide\n\n' +
      '### Status Flow\n\n' +
      '```\n' +
      'Booking:  PENDING_CONFIRMATION ──confirm──► CONFIRMED ──complete──► COMPLETED\n' +
      '                │                    │\n' +
      '                └──reject──► REJECTED └──cancel──► CANCELLED\n\n' +
      'Payment:  PENDING_PROOF ──upload──► PENDING_REVIEW\n' +
      '                                    ├──settle──► SETTLED\n' +
      '                                    └──reject──► REJECTED ──re-upload──► PENDING_REVIEW\n' +
      '```\n\n' +
      '### Learner Flow\n\n' +
      '1. `GET /api/coaches/:coachId` → Check coach profile and `hourlyRateVnd`.\n' +
      '2. **`POST /api/coaches/:coachId/bookings`** ← **you are here**. Price auto-snapshotted.\n' +
      '3. `GET /api/learner/bookings?status=PENDING_CONFIRMATION` → Poll until coach accepts.\n' +
      '4. Once `status = CONFIRMED` → transfer money via bank account / QR (from `coachProfile` in response).\n' +
      '5. `PATCH /api/learner/bookings/:bookingId/payment-proof` → Submit proof URL.\n' +
      '6. Poll until `paymentStatus = SETTLED`, then `status = COMPLETED`.\n' +
      '7. After COMPLETED → learner can leave a review (Phase 3).\n\n' +
      '### Coach Flow\n\n' +
      '1. `GET /api/coach/bookings?status=PENDING_CONFIRMATION` → See new requests.\n' +
      '2. `PATCH /api/coach/bookings/:id/confirm` → Accept (with optional `coachNote`).\n' +
      '   OR `PATCH /api/coach/bookings/:id/reject` → Decline with optional reason.\n' +
      '3. `PATCH /api/coach/bookings/:id/settle-payment` → Confirm bank transfer received.\n' +
      '4. `PATCH /api/coach/bookings/:id/complete` → Mark session done (unlocks learner review).\n\n' +
      '### BookingStatus Reference\n\n' +
      '| Value | Meaning |\n' +
      '|---|---|\n' +
      '| `PENDING_CONFIRMATION` | Awaiting coach accept/reject |\n' +
      '| `CONFIRMED` | Accepted — learner should pay now |\n' +
      '| `COMPLETED` | Session done — learner can review |\n' +
      '| `REJECTED` | Coach declined |\n' +
      '| `CANCELLED` | Cancelled by either party |\n\n' +
      '### PaymentStatus Reference\n\n' +
      '| Value | Meaning |\n' +
      '|---|---|\n' +
      '| `null` | Booking not yet confirmed — payment is not relevant yet |\n' +
      '| `PENDING_PROOF` | Confirmed, learner should pay and upload proof |\n' +
      '| `PENDING_REVIEW` | Proof submitted, coach reviewing |\n' +
      '| `SETTLED` | Coach confirmed payment |\n' +
      '| `REJECTED` | Proof rejected — learner must re-upload |',
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID.', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiResponse({
    status: 201,
    description: 'Booking request created. Status is PENDING_CONFIRMATION.',
    schema: { example: BOOKING_WITH_COACH_EXAMPLE },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — coach has no hourly rate set.', schema: { example: { statusCode: 400, message: 'This coach has not set an hourly rate yet.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach not found or not publicly available.', schema: { example: { statusCode: 404, message: 'Coach not found or not publicly available.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.CREATED)
  createBooking(
    @Request() req: any,
    @Param('coachId', ParseUUIDPipe) coachId: string,
    @Body() dto: CreatePrivateBookingDto,
  ) {
    return this.bookingService.createBooking(req.user.userId, coachId, dto);
  }

  @Get('api/learner/bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) List my booking requests',
    description:
      'Returns a paginated list of all private booking requests made by the current learner. Optionally filter by `status`.\n\n' +
      'Each result includes the coach profile and bank information so the learner knows where to transfer after confirmation.\n\n' +
      'Payment status guide:\n\n' +
      '- `null` → booking not yet confirmed — payment is not relevant yet\n' +
      '- `PENDING_PROOF` → booking confirmed, learner should pay and upload proof\n' +
      '- `PENDING_REVIEW` → proof uploaded, waiting for coach to settle\n' +
      '- `SETTLED` → coach confirmed payment received\n' +
      '- `REJECTED` → proof rejected, learner must re-upload',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'COMPLETED', 'REJECTED', 'CANCELLED'] })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Return only bookings whose `sessionAt` is on or after this date (ISO 8601, UTC).' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Return only bookings whose `sessionAt` is on or before this date (ISO 8601, UTC).' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of the learner\'s bookings with coach info.',
    schema: {
      example: {
        data: [BOOKING_CONFIRMED_EXAMPLE],
        pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @HttpCode(HttpStatus.OK)
  listMyBookings(@Request() req: any, @Query() query: ListBookingsQueryDto) {
    return this.bookingService.listLearnerBookings(req.user.userId, query);
  }

  @Patch('api/learner/bookings/:bookingId/payment-proof')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) Upload payment proof for a booking',
    description:
      'Submits a bank transfer proof for a **CONFIRMED** booking. Moves `paymentStatus` → **PENDING_REVIEW**.\n\n' +
      'Upload the image first via the media-service (`POST /api/media/upload`), then pass the returned URL here.\n\n' +
      '**Returns 400** if the booking is not CONFIRMED, or payment is already SETTLED.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Proof submitted. paymentStatus is now PENDING_REVIEW.',
    schema: {
      example: {
        ...BOOKING_WITH_COACH_EXAMPLE,
        status: 'CONFIRMED',
        paymentStatus: 'PENDING_REVIEW',
        paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/booking-txn-xyz789.jpg',
        proofUploadedAt: '2026-07-12T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — booking not confirmed or payment already settled.', schema: { example: { statusCode: 400, message: 'Payment can only be submitted for CONFIRMED bookings.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — booking belongs to another learner.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  uploadPaymentProof(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: UploadBookingProofDto,
  ) {
    return this.bookingService.uploadPaymentProof(req.user.userId, bookingId, dto);
  }

  @Delete('api/learner/bookings/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) Cancel my booking request',
    description:
      'Cancels a booking that is in **PENDING_CONFIRMATION** or **CONFIRMED** status. Cannot cancel a booking that has already been paid (`paymentStatus: SETTLED`).\n\n' +
      '**Returns 400** if the booking is COMPLETED, REJECTED, or CANCELLED.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled.',
    schema: { example: { ...BOOKING_WITH_COACH_EXAMPLE, status: 'CANCELLED', cancelReason: 'Cancelled by learner.' } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — booking cannot be cancelled.', schema: { example: { statusCode: 400, message: 'Cannot cancel a booking with status COMPLETED.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  cancelBooking(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingService.learnerCancelBooking(req.user.userId, bookingId);
  }
}

// ─────────────────────────────────────
//  Coach endpoints: /api/coach/bookings
// ─────────────────────────────────────

@ApiTags('Private Bookings — Coach Actions')
@Controller('api/coach/bookings')
@RequireSubscription('COACH')
export class CoachBookingController {
  constructor(private readonly bookingService: PrivateBookingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) List my incoming booking requests',
    description:
      'Returns a paginated list of all private booking requests received by the current coach. Filter by `status` to focus on a specific queue:\n\n' +
      '- `PENDING_CONFIRMATION` — new requests awaiting coach action\n' +
      '- `CONFIRMED` — accepted bookings, payment may be in progress\n' +
      '- `COMPLETED` — finished sessions\n' +
      '- `REJECTED` / `CANCELLED` — declined or cancelled bookings',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'COMPLETED', 'REJECTED', 'CANCELLED'] })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Return only bookings whose `sessionAt` is on or after this date (ISO 8601, UTC).' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Return only bookings whose `sessionAt` is on or before this date (ISO 8601, UTC).' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of incoming bookings.',
    schema: {
      example: {
        data: [BOOKING_EXAMPLE],
        pagination: { page: 1, limit: 10, total: 5, totalPages: 1 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach profile not found.', schema: { example: { statusCode: 404, message: 'Coach profile not found. Please register as a coach first.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  listBookings(@Request() req: any, @Query() query: ListBookingsQueryDto) {
    return this.bookingService.listCoachBookings(req.user.userId, query);
  }

  @Patch(':bookingId/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Confirm a booking request',
    description:
      'Accepts a **PENDING_CONFIRMATION** booking. Status moves to **CONFIRMED**.\n\n' +
      'After confirmation, the learner can see the coach\'s bank details and upload their payment proof.\n\n' +
      'Optionally include a `coachNote` (e.g. venue confirmation, preparation tips).',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Booking confirmed. Status is now CONFIRMED.',
    schema: {
      example: {
        ...BOOKING_EXAMPLE,
        status: 'CONFIRMED',
        coachNote: 'Xác nhận buổi tập. Vui lòng chuyển khoản và gửi minh chứng.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — booking is not PENDING_CONFIRMATION.', schema: { example: { statusCode: 400, message: 'Only PENDING_CONFIRMATION bookings can be confirmed. Current status: CONFIRMED.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — booking belongs to another coach.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  confirmBooking(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: ConfirmBookingDto,
  ) {
    return this.bookingService.confirmBooking(req.user.userId, bookingId, dto);
  }

  @Patch(':bookingId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Reject a booking request',
    description:
      'Declines a **PENDING_CONFIRMATION** booking. Status moves to **REJECTED**.\n\n' +
      'Optionally provide a `cancelReason` to explain why (e.g. schedule conflict). The learner will see this reason.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Booking rejected. Status is now REJECTED.',
    schema: {
      example: {
        ...BOOKING_EXAMPLE,
        status: 'REJECTED',
        cancelReason: 'Xin lỗi, tôi đã có lịch bận vào khung giờ đó.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — booking is not PENDING_CONFIRMATION.', schema: { example: { statusCode: 400, message: 'Only PENDING_CONFIRMATION bookings can be rejected. Current status: CONFIRMED.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  rejectBooking(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookingService.rejectBooking(req.user.userId, bookingId, dto);
  }

  @Patch(':bookingId/settle-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Settle payment for a booking',
    description:
      'Confirms that the coach has received the bank transfer. Moves `paymentStatus` from `PENDING_REVIEW` → **SETTLED**.\n\n' +
      'After settling, the coach can then mark the session as complete via `PATCH /api/coach/bookings/:bookingId/complete`.\n\n' +
      '**Returns 400** if payment is not in `PENDING_REVIEW` state.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Payment settled. paymentStatus is now SETTLED.',
    schema: {
      example: {
        ...BOOKING_EXAMPLE,
        status: 'CONFIRMED',
        paymentStatus: 'SETTLED',
        settledAt: '2026-07-13T09:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — payment not PENDING_REVIEW.', schema: { example: { statusCode: 400, message: 'Payment must be PENDING_REVIEW to settle.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  settlePayment(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingService.settlePayment(req.user.userId, bookingId);
  }

  @Patch(':bookingId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Mark a session as completed',
    description:
      'Marks a **CONFIRMED** booking as **COMPLETED** after the physical session has been delivered. This unlocks the ability for the learner to leave a review.\n\n' +
      '**Requires `paymentStatus = SETTLED`** — the coach must confirm payment has been received before closing the session.\n\n' +
      '**Returns 400** if payment is not yet SETTLED.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Session marked as COMPLETED. Learner can now leave a review.',
    schema: {
      example: {
        ...BOOKING_EXAMPLE,
        status: 'COMPLETED',
        paymentStatus: 'SETTLED',
        completedAt: '2026-07-20T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — booking not CONFIRMED or payment not SETTLED.', schema: { example: { statusCode: 400, message: 'Payment must be SETTLED before marking a booking as completed.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  completeBooking(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingService.completeBooking(req.user.userId, bookingId);
  }

  @Patch(':bookingId/reject-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Reject a payment proof',
    description:
      'Rejects the learner\'s bank transfer proof. Moves `paymentStatus` from `PENDING_REVIEW` → **REJECTED** and clears `paymentProofUrl`.\n\n' +
      'The learner can then re-upload a clearer image via `PATCH /api/learner/bookings/:bookingId/payment-proof`.\n\n' +
      '**Returns 400** if payment is not in `PENDING_REVIEW` state.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Proof rejected. paymentStatus is now REJECTED. Learner must re-upload.',
    schema: {
      example: {
        ...BOOKING_EXAMPLE,
        status: 'CONFIRMED',
        paymentStatus: 'REJECTED',
        paymentProofUrl: null,
        proofUploadedAt: '2026-07-12T09:00:00.000Z', // kept as audit history
        settledAt: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — payment not PENDING_REVIEW.', schema: { example: { statusCode: 400, message: 'Payment must be PENDING_REVIEW to reject.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  rejectPayment(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookingService.rejectBookingPayment(req.user.userId, bookingId);
  }

  @Delete(':bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Cancel a confirmed booking',
    description:
      'Allows the coach to cancel a **CONFIRMED** booking (e.g. emergency, venue unavailable). A `cancelReason` is recommended.\n\n' +
      '**Returns 400** if the booking is not in CONFIRMED status.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled by coach.',
    schema: {
      example: {
        ...BOOKING_EXAMPLE,
        status: 'CANCELLED',
        cancelReason: 'Sân bị đóng cửa do sự cố, xin lỗi bạn.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — booking is not CONFIRMED.', schema: { example: { statusCode: 400, message: 'Only CONFIRMED bookings can be cancelled by the coach.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  cancelBooking(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookingService.coachCancelBooking(req.user.userId, bookingId, dto);
  }

  @Patch(':bookingId/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Link or update the venue / court for a booking',
    description:
      'Sets or replaces the location on an existing private booking. Can be called at any time while the booking is not CANCELLED or COMPLETED.\n\n' +
      '**Mode A — court link:** Provide `courtBookingId` (+ `courtId` if the booking covers multiple courts). ' +
      'The court booking must be CONFIRMED and owned by the authenticated coach. ' +
      'Court cost is re-snapshotted and any existing free-text location is wiped.\n\n' +
      '**Mode B — free text:** Provide `locationDescription`. Wipes any existing court link and cost.\n\n' +
      '**Mode C — clear:** Send an empty body `{}` to reset location to null.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID.', example: 'a1000001-a100-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Location updated.',
    schema: {
      example: {
        ...BOOKING_EXAMPLE,
        status: 'CONFIRMED',
        courtBookingId: 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
        courtId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        courtCostVnd: 300000,
        locationDescription: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request — invalid court booking or booking is CANCELLED/COMPLETED.', schema: { example: { statusCode: 400, message: 'Court booking is not CONFIRMED.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — booking or court booking belongs to another coach.', schema: { example: { statusCode: 403, message: 'You do not own this booking.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Booking not found.', schema: { example: { statusCode: 404, message: 'Booking not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  updateBookingLocation(
    @Request() req: any,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: UpdateSessionLocationDto,
  ) {
    return this.bookingService.updateBookingLocation(req.user.userId, bookingId, dto);
  }
}
