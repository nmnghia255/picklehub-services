import {
  Controller,
  Get,
  Post,
  Patch,
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
} from '@nestjs/swagger';
import { CoachClassService } from './coach-class.service';
import { CreateCoachClassDto } from './dto/create-coach-class.dto';
import { UpdateCoachClassDto } from './dto/update-coach-class.dto';
import { ListClassesQueryDto } from './dto/list-classes-query.dto';
import { ListMyClassesQueryDto } from './dto/list-my-classes-query.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequireSubscription } from '../guards/subscription.guard';

// ─── Shared Swagger example objects ───────────────────────────────────────────

const SCHEDULE_EXAMPLE = {
  id: 'e0000001-e000-4000-8000-000000000001',
  classId: 'f0000001-f000-4000-8000-000000000001',
  scheduledAt: '2026-07-19T09:00:00.000Z',
  durationMinutes: 90,
  topic: 'Luyện tập kỹ thuật serve và return',
  note: 'Mang vợt riêng. Sân số 3.',
  createdAt: '2026-07-01T00:00:00.000Z',
};

const CLASS_EXAMPLE = {
  id: 'f0000001-f000-4000-8000-000000000001',
  coachProfileId: 'c0000001-c000-4000-8000-000000000001',
  title: 'Pickleball Beginner Boot Camp',
  description: 'A 4-week group class focused on foundational pickleball skills for absolute beginners.',
  level: 'Beginner',
  capacity: 10,
  enrolledCount: 3,
  priceVnd: 1500000,
  locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Hà Nội',
  coverImageUrl: 'https://cdn.picklehub.vn/classes/bootcamp-cover.jpg',
  status: 'OPEN',
  startDate: '2026-07-15T00:00:00.000Z',
  endDate: '2026-08-15T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z',
  schedules: [SCHEDULE_EXAMPLE],
};

const CLASS_WITH_COACH_EXAMPLE = {
  ...CLASS_EXAMPLE,
  coachProfile: {
    id: 'c0000001-c000-4000-8000-000000000001',
    displayName: 'Nguyễn Văn Coach',
    avatarUrl: 'https://cdn.picklehub.vn/avatars/coach1.jpg',
    verificationStatus: 'VERIFIED',
    locationCity: 'Hà Nội',
    paymentAccountName: 'Nguyen Van Coach',
    paymentAccountNumber: '0123456789',
    paymentBankName: 'Techcombank',
    paymentQrUrl: 'https://cdn.picklehub.vn/qr/coach1.png',
  },
};

// ─────────────────────────────────────
//  Coach-side endpoints: /api/coach/classes
// ─────────────────────────────────────

@ApiTags('Coach Classes — Coach Actions')
@Controller('api/coach/classes')
@RequireSubscription('COACH')
export class CoachClassController {
  constructor(private readonly coachClassService: CoachClassService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Create a new class',
    description:
      'Creates a new coaching class in **DRAFT** status. The class is hidden from learners until the coach publishes it via `POST /api/coach/classes/:classId/publish`.\n\n' +
      'You can add session schedules after creation via `POST /api/coach/classes/:classId/schedules`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Class created successfully. Status is DRAFT.',
    schema: { example: { ...CLASS_EXAMPLE, status: 'DRAFT', enrolledCount: 0, schedules: [] } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — invalid fields.', schema: { example: { statusCode: 400, message: ['capacity must be a positive integer'], error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach profile not found.', schema: { example: { statusCode: 404, message: 'Coach profile not found. Please register as a coach first.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateCoachClassDto) {
    return this.coachClassService.create(req.user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) List my classes',
    description:
      'Returns all classes owned by the current coach, across **all statuses** (DRAFT, OPEN, FULL, ONGOING, COMPLETED, CANCELLED). Ordered newest first.\n\n' +
      'Each item includes the list of `schedules` and the `_count.enrollments` number.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all coach\'s classes.',
    schema: {
      example: [
        { ...CLASS_EXAMPLE, _count: { enrollments: 3 } },
        { ...CLASS_EXAMPLE, id: 'f0000002-f000-4000-8000-000000000002', title: 'Advanced Strategy Workshop', status: 'DRAFT', enrolledCount: 0, _count: { enrollments: 0 } },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach profile not found.', schema: { example: { statusCode: 404, message: 'Coach profile not found. Please register as a coach first.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  listMy(@Request() req: any, @Query() query: ListMyClassesQueryDto) {
    return this.coachClassService.listMyClasses(req.user.userId, query);
  }

  @Get(':classId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Get my class detail',
    description: 'Returns full detail of a specific class owned by the current coach. Includes all schedules and enrollment count.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Class detail with schedules.',
    schema: { example: { ...CLASS_EXAMPLE, _count: { enrollments: 3 } } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — class belongs to another coach.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  findMy(@Request() req: any, @Param('classId', ParseUUIDPipe) classId: string) {
    return this.coachClassService.findMyClass(req.user.userId, classId);
  }

  @Patch(':classId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Update a class',
    description:
      'Updates editable fields on an existing class. All fields are optional — only send what you want to change.\n\n' +
      '**Only DRAFT or OPEN classes can be edited.** Editing ONGOING, COMPLETED, or CANCELLED classes returns 400.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Class updated successfully.',
    schema: { example: { ...CLASS_EXAMPLE, title: 'Updated Class Title', updatedAt: '2026-07-10T00:00:00.000Z' } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — class is not in an editable status.', schema: { example: { statusCode: 400, message: 'Only DRAFT or OPEN classes can be edited.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — class belongs to another coach.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: UpdateCoachClassDto,
  ) {
    return this.coachClassService.update(req.user.userId, classId, dto);
  }

  @Post(':classId/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Publish a class — make it visible to learners',
    description:
      'Changes a class status from **DRAFT → OPEN**. After publishing, learners can discover and enroll in the class.\n\n' +
      '**Returns 400** if the class is not in DRAFT status.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Class is now OPEN and discoverable by learners.',
    schema: { example: { ...CLASS_EXAMPLE, status: 'OPEN' } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — class is not in DRAFT status.', schema: { example: { statusCode: 400, message: 'Class cannot be published — current status is OPEN.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  publish(@Request() req: any, @Param('classId', ParseUUIDPipe) classId: string) {
    return this.coachClassService.publish(req.user.userId, classId);
  }

  @Post(':classId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Cancel a class',
    description:
      'Cancels a class regardless of its current status, as long as it is not already CANCELLED or COMPLETED.\n\n' +
      'Existing enrollments remain in the database but the class becomes unavailable for new enrollments.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Class cancelled successfully.',
    schema: { example: { ...CLASS_EXAMPLE, status: 'CANCELLED' } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — class is already cancelled or completed.', schema: { example: { statusCode: 400, message: 'Class is already CANCELLED and cannot be cancelled.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  cancel(@Request() req: any, @Param('classId', ParseUUIDPipe) classId: string) {
    return this.coachClassService.cancel(req.user.userId, classId);
  }
}

// ─────────────────────────────────────
//  Public class endpoints: /api/classes
// ─────────────────────────────────────

@ApiTags('Coach Classes — Public Discovery')
@Controller('api/classes')
export class PublicClassController {
  constructor(private readonly coachClassService: CoachClassService) {}

  @Get()
  @ApiOperation({
    summary: '(Any) Discover open classes',
    description:
      'Returns a paginated list of all **OPEN** classes. Supports optional filters:\n\n' +
      '- `city` — filter by coach\'s city (case-insensitive partial match)\n' +
      '- `level` — filter by class level: `Beginner`, `Intermediate`, `Advanced`, `Pro`\n\n' +
      'Each result includes the coach\'s **bank information** so learners know where to pay.\n\n' +
      '**No authentication required.**',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of open classes with coach bank info.',
    schema: {
      example: {
        data: [CLASS_WITH_COACH_EXAMPLE],
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  listPublic(@Query() query: ListClassesQueryDto) {
    return this.coachClassService.listPublic(query);
  }

  @Get(':classId')
  @ApiOperation({
    summary: '(Any) Get a class\'s public detail',
    description:
      'Returns full detail of an OPEN or ONGOING class, including all schedules and the coach\'s **bank information** for payment purposes.\n\n' +
      'Returns 404 if the class does not exist or is not OPEN/ONGOING.\n\n' +
      '**No authentication required.**',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Class detail with schedules and coach bank info.',
    schema: { example: CLASS_WITH_COACH_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Class not found or not currently open.', schema: { example: { statusCode: 404, message: 'Class not found or not currently open.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  findOnePublic(@Param('classId', ParseUUIDPipe) classId: string) {
    return this.coachClassService.findOnePublic(classId);
  }
}
