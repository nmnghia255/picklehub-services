import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
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
} from '@nestjs/swagger';
import { ClassEnrollmentService } from './class-enrollment.service';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequireSubscription } from '../guards/subscription.guard';

// ─── Shared Swagger example objects ───────────────────────────────────────────

const ENROLLMENT_EXAMPLE = {
  id: 'b0000001-b000-4000-8000-000000000001',
  classId: 'f0000001-f000-4000-8000-000000000001',
  learnerId: 'a0000010-a000-4000-8000-000000000010',
  status: 'ACTIVE',
  paymentStatus: 'PENDING_PROOF',
  amountVnd: 1500000,
  paymentProofUrl: null,
  proofUploadedAt: null,
  settledAt: null,
  enrolledAt: '2026-07-05T10:00:00.000Z',
  cancelledAt: null,
  learnerProfile: {
    id: 'a0000010-a000-4000-8000-000000000010',
    name: 'Learner One',
    email: 'learner1@example.com',
    role: 'USER',
    avatarUrl: 'https://cdn.picklehub.vn/avatars/learner1.jpg',
  },
};

const ENROLLMENT_WITH_BANK_EXAMPLE = {
  ...ENROLLMENT_EXAMPLE,
  coachPaymentInfo: {
    paymentAccountName: 'Nguyen Van Coach',
    paymentAccountNumber: '0123456789',
    paymentBankName: 'Techcombank',
    paymentQrUrl: 'https://cdn.picklehub.vn/qr/coach1.png',
  },
};

const ENROLLMENT_WITH_CLASS_EXAMPLE = {
  ...ENROLLMENT_EXAMPLE,
  paymentStatus: 'PENDING_REVIEW',
  paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-abc123.jpg',
  proofUploadedAt: '2026-07-06T08:30:00.000Z',
  coachClass: {
    id: 'f0000001-f000-4000-8000-000000000001',
    title: 'Pickleball Beginner Boot Camp',
    level: 'Beginner',
    priceVnd: 1500000,
    locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Hà Nội',
    coverImageUrl: 'https://cdn.picklehub.vn/classes/bootcamp-cover.jpg',
    status: 'OPEN',
    coachProfile: {
      id: 'c0000001-c000-4000-8000-000000000001',
      displayName: 'Nguyễn Văn Coach',
      avatarUrl: 'https://cdn.picklehub.vn/avatars/coach1.jpg',
      paymentAccountName: 'Nguyen Van Coach',
      paymentAccountNumber: '0123456789',
      paymentBankName: 'Techcombank',
      paymentQrUrl: 'https://cdn.picklehub.vn/qr/coach1.png',
    },
  },
};

// ─────────────────────────────────────
//  Learner endpoints: /api/classes & /api/learner/class-enrollments
// ─────────────────────────────────────

@ApiTags('Class Enrollments — Learner Actions')
@Controller()
export class LearnerEnrollmentController {
  constructor(private readonly enrollmentService: ClassEnrollmentService) {}

  @Post('api/classes/:classId/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) Enroll in a class',
    description:
      'Enrolls the current user in an OPEN class. Enrollment is **auto-confirmed instantly** — the spot is reserved and payment can follow at any time.\n\n' +
      '> **Payment is deferred, not immediate.** The learner does not need to pay right away. ' +
      'The response includes `coachPaymentInfo` as a convenience shortcut, but the coach bank details ' +
      'are always retrievable later via `GET /api/learner/class-enrollments` or `GET /api/classes/:classId`.\n\n' +
      '**Returns 409** if the learner is already enrolled. **Returns 400** if the class is full or not OPEN.\n\n' +
      '---\n\n' +
      '## Phase 2A — Group Class Integration Guide\n\n' +
      '### Status Flow\n\n' +
      '```\n' +
      'Class:      DRAFT ──publish──► OPEN ──[full]──► FULL\n' +
      '                                 └──cancel──► CANCELLED\n\n' +
      'Enrollment: ACTIVE ──────────────────────────────► CANCELLED\n\n' +
      'Payment:    PENDING_PROOF ──upload──► PENDING_REVIEW\n' +
      '                                      ├──settle──► SETTLED\n' +
      '                                      └──reject──► REJECTED ──re-upload──► PENDING_REVIEW\n' +
      '```\n\n' +
      '### Coach Flow\n\n' +
      '1. `POST /api/coach/classes` → Create class (DRAFT).\n' +
      '2. `POST /api/coach/classes/:classId/schedules` → Add session slots.\n' +
      '3. `POST /api/coach/classes/:classId/publish` → Make visible (DRAFT → OPEN).\n' +
      '4. `GET /api/coach/classes/:classId/enrollments` → Monitor learner payments.\n' +
      '5. `PATCH …/enrollments/:id/settle` → Confirm received transfer.\n' +
      '6. `PATCH …/enrollments/:id/reject-payment` → Reject bad proof (learner re-uploads).\n\n' +
      '### Learner Flow\n\n' +
      '1. `GET /api/classes` → Discover OPEN classes.\n' +
      '2. `GET /api/classes/:classId` → View class detail (includes coach bank info).\n' +
      '3. **`POST /api/classes/:classId/enroll`** ← **you are here**. Spot is reserved. Response includes `coachPaymentInfo` for convenience.\n' +
      '4. *(Anytime)* Transfer money via bank account / QR code. Coach bank info is always available in `GET /api/learner/class-enrollments`.\n' +
      '5. Upload proof image via media-service → get a URL.\n' +
      '6. `PATCH /api/learner/class-enrollments/:enrollmentId/payment-proof` → Submit the proof URL.\n' +
      '7. `GET /api/learner/class-enrollments` → Check `paymentStatus` until it becomes `SETTLED`.\n\n' +
      '### PaymentStatus Reference\n\n' +
      '| Value | Meaning | Learner Action |\n' +
      '|---|---|---|\n' +
      '| `PENDING_PROOF` | Enrolled, no proof submitted yet | Pay anytime, then upload proof |\n' +
      '| `PENDING_REVIEW` | Proof submitted, awaiting coach | Wait |\n' +
      '| `SETTLED` | Coach confirmed payment received | Done |\n' +
      '| `REJECTED` | Proof rejected by coach | Re-upload a clearer image |',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 201,
    description: 'Enrolled successfully. Includes coach bank info for payment.',
    schema: { example: ENROLLMENT_WITH_BANK_EXAMPLE },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — class is not OPEN or is full.', schema: { example: { statusCode: 400, message: 'This class is not open for enrollment.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @ApiResponse({ status: 409, description: 'Conflict — already enrolled.', schema: { example: { statusCode: 409, message: 'You are already enrolled in this class.', error: 'Conflict' } } })
  @HttpCode(HttpStatus.CREATED)
  enroll(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.enrollmentService.enroll(req.user.userId, classId);
  }

  @Get('api/learner/class-enrollments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) List my class enrollments',
    description:
      'Returns all class enrollments for the current user, ordered newest first. Includes the class detail and coach bank info for any outstanding payments.\n\n' +
      'Use `paymentStatus` to know what action to take:\n\n' +
      '- `PENDING_PROOF` → learner needs to upload bank transfer proof\n' +
      '- `PENDING_REVIEW` → proof uploaded, waiting for coach to settle\n' +
      '- `SETTLED` → payment confirmed by coach\n' +
      '- `REJECTED` → proof rejected, learner must re-upload',
  })
  @ApiResponse({
    status: 200,
    description: 'List of the learner\'s enrollments with class and payment info.',
    schema: { example: [ENROLLMENT_WITH_CLASS_EXAMPLE] },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @HttpCode(HttpStatus.OK)
  listMyEnrollments(@Request() req: any) {
    return this.enrollmentService.listMyEnrollments(req.user.userId);
  }

  @Patch('api/learner/class-enrollments/:enrollmentId/payment-proof')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) Upload payment proof for an enrollment',
    description:
      'Submits a bank transfer proof image URL for an active enrollment. This moves `paymentStatus` from `PENDING_PROOF` or `REJECTED` → **PENDING_REVIEW**.\n\n' +
      'Upload the image via the media-service first (`POST /api/media/upload`), then pass the returned URL here.\n\n' +
      '**Returns 400** if the enrollment is not ACTIVE or if payment is already SETTLED.',
  })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment UUID.', example: 'b0000001-b000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Payment proof submitted. paymentStatus is now PENDING_REVIEW.',
    schema: {
      example: {
        ...ENROLLMENT_EXAMPLE,
        paymentStatus: 'PENDING_REVIEW',
        paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-abc123.jpg',
        proofUploadedAt: '2026-07-06T08:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — payment already settled or enrollment not active.', schema: { example: { statusCode: 400, message: 'Payment is already settled.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — enrollment belongs to another user.', schema: { example: { statusCode: 403, message: 'You can only update your own enrollment.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Enrollment not found.', schema: { example: { statusCode: 404, message: 'Enrollment not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  uploadPaymentProof(
    @Request() req: any,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: UploadPaymentProofDto,
  ) {
    return this.enrollmentService.uploadPaymentProof(req.user.userId, enrollmentId, dto);
  }

  @Delete('api/learner/class-enrollments/:enrollmentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) Cancel my enrollment',
    description:
      'Cancels an active enrollment. The `enrolledCount` on the class is decremented, freeing up one spot.\n\n' +
      '**Returns 400** if the enrollment is already CANCELLED or COMPLETED.',
  })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment UUID.', example: 'b0000001-b000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Enrollment cancelled.',
    schema: { example: { ...ENROLLMENT_EXAMPLE, status: 'CANCELLED', cancelledAt: '2026-07-07T10:00:00.000Z' } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — enrollment is not active.', schema: { example: { statusCode: 400, message: 'Only active enrollments can be cancelled.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You can only cancel your own enrollment.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Enrollment not found.', schema: { example: { statusCode: 404, message: 'Enrollment not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  cancelEnrollment(
    @Request() req: any,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.enrollmentService.cancelEnrollment(req.user.userId, enrollmentId);
  }
}

// ─────────────────────────────────────
//  Coach endpoints: /api/coach/classes/:classId/enrollments
// ─────────────────────────────────────

@ApiTags('Class Enrollments — Coach Actions')
@Controller('api/coach/classes/:classId/enrollments')
@RequireSubscription('COACH')
export class CoachEnrollmentController {
  constructor(private readonly enrollmentService: ClassEnrollmentService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) View enrollments for a class',
    description:
      'Returns all learner enrollments for a specific class, including `paymentStatus` for each. Ordered newest first.\n\n' +
      'Use this to monitor who has enrolled and which learners still need to submit or have their payment settled.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'List of enrollments with payment status.',
    schema: {
      example: [
        { ...ENROLLMENT_EXAMPLE, paymentStatus: 'SETTLED', settledAt: '2026-07-08T00:00:00.000Z' },
        { ...ENROLLMENT_EXAMPLE, id: 'b0000002-b000-4000-8000-000000000002', paymentStatus: 'PENDING_REVIEW', paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-def456.jpg' },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  listEnrollments(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.enrollmentService.listClassEnrollments(req.user.userId, classId);
  }

  @Patch(':enrollmentId/settle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Mark payment as settled',
    description:
      'Confirms that the coach has received the bank transfer for this enrollment. Moves `paymentStatus` from `PENDING_REVIEW` → **SETTLED**.\n\n' +
      '**Returns 400** if payment is not in `PENDING_REVIEW` state.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment UUID.', example: 'b0000001-b000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Payment settled. paymentStatus is now SETTLED.',
    schema: {
      example: {
        ...ENROLLMENT_EXAMPLE,
        paymentStatus: 'SETTLED',
        settledAt: '2026-07-08T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — payment is not PENDING_REVIEW.', schema: { example: { statusCode: 400, message: 'Enrollment payment must be PENDING_REVIEW to settle.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Enrollment not found in this class.', schema: { example: { statusCode: 404, message: 'Enrollment not found in this class.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  settlePayment(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.enrollmentService.settlePayment(req.user.userId, classId, enrollmentId);
  }

  @Patch(':enrollmentId/reject-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Reject a payment proof',
    description:
      'Rejects the learner\'s submitted payment proof. Moves `paymentStatus` back to **REJECTED**, clears `paymentProofUrl`, and the learner must re-upload a valid proof.\n\n' +
      'Optionally provide a `reason` to help the learner understand why it was rejected.\n\n' +
      '**Returns 400** if payment is not in `PENDING_REVIEW` state.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiParam({ name: 'enrollmentId', description: 'Enrollment UUID.', example: 'b0000001-b000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Payment proof rejected. paymentStatus is now REJECTED.',
    schema: {
      example: {
        ...ENROLLMENT_EXAMPLE,
        paymentStatus: 'REJECTED',
        paymentProofUrl: null,
        proofUploadedAt: '2026-07-06T08:30:00.000Z', // kept as audit history
        settledAt: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — payment is not PENDING_REVIEW.', schema: { example: { statusCode: 400, message: 'Enrollment payment must be PENDING_REVIEW to reject.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Enrollment not found in this class.', schema: { example: { statusCode: 404, message: 'Enrollment not found in this class.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  rejectPayment(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.enrollmentService.rejectPayment(req.user.userId, classId, enrollmentId, dto);
  }
}
