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
import { CoachProfileService } from './coach-profile.service';
import { CreateCoachProfileDto } from './dto/create-coach-profile.dto';
import { UpdateCoachProfileDto } from './dto/update-coach-profile.dto';
import { ListCoachesQueryDto } from './dto/list-coaches-query.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CoachClassService } from '../coach-class/coach-class.service';
import { RequireSubscription } from '../guards/subscription.guard';

// ─── Sample response objects shared across Swagger examples ───
const COACH_PROFILE_EXAMPLE = {
  id: 'c0000001-c000-4000-8000-000000000001',
  userId: 'a0000001-a000-4000-8000-000000000001',
  displayName: 'Nguyễn Văn Coach',
  bio: 'Hơn 5 năm kinh nghiệm huấn luyện Pickleball chuyên nghiệp tại Hà Nội.',
  avatarUrl: 'https://cdn.picklehub.vn/avatars/coach1.jpg',
  level: 'Advanced',
  yearsExperience: 5,
  specialties: ['Kỹ thuật serve', 'Dinking', 'Doubles strategy'],
  languages: ['Tiếng Việt', 'English'],
  locationCity: 'Hà Nội',
  hourlyRateVnd: 300000,
  paymentAccountName: 'Nguyen Van Coach',
  paymentAccountNumber: '0123456789',
  paymentBankName: 'Techcombank',
  paymentQrUrl: 'https://cdn.picklehub.vn/qr/coach1.png',
  status: 'ACTIVE',
  verificationStatus: 'VERIFIED',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
  certifications: [
    {
      id: 'd0000001-d000-4000-8000-000000000001',
      name: 'USAPA Level 2 Instructor',
      issuingOrganization: 'USA Pickleball Association',
      issuedAt: '2024-03-15T00:00:00.000Z',
      expiresAt: null,
      documentUrl: 'https://cdn.picklehub.vn/certs/usapa-l2.pdf',
      verificationStatus: 'VERIFIED',
      coachProfileId: 'c0000001-c000-4000-8000-000000000001',
      reviewedByUserId: null,
      reviewNote: null,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-25T10:00:00.000Z',
    },
  ],
  averageRating: 4.8,
  reviewCount: 15,
};

const COACH_PROFILE_PUBLIC_EXAMPLE = {
  id: 'c0000001-c000-4000-8000-000000000001',
  userId: 'a0000001-a000-4000-8000-000000000001',
  displayName: 'Nguyễn Văn Coach',
  avatarUrl: 'https://cdn.picklehub.vn/avatars/coach1.jpg',
  level: 'Advanced',
  yearsExperience: 5,
  specialties: ['Kỹ thuật serve', 'Dinking', 'Doubles strategy'],
  languages: ['Tiếng Việt', 'English'],
  locationCity: 'Hà Nội',
  hourlyRateVnd: 300000,
  verificationStatus: 'VERIFIED',
  createdAt: '2026-06-01T00:00:00.000Z',
  averageRating: 4.8,
  reviewCount: 15,
};

// ─────────────────────────────────────
//  Coach-side endpoints: /api/coach/profile
// ─────────────────────────────────────

@ApiTags('Coach Profile — Coach Actions')
@Controller('api/coach/profile')
@RequireSubscription('COACH')
export class CoachProfileController {
  constructor(private readonly coachProfileService: CoachProfileService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Any User) Register as a coach',
    description:
      'Creates a new coach profile for the currently logged-in user. **Bank information is required at this step** so learners can pay the coach after enrolling in a class or booking a private session.\n\n' +
      'The profile starts in **DRAFT** status and is not visible to other users until the coach publishes it via `POST /api/coach/profile/me/publish`.\n\n' +
      '**Returns 409** if the user already has a coach profile.',
  })
  @ApiResponse({
    status: 201,
    description: 'Coach profile created successfully. Status is DRAFT.',
    schema: { example: { ...COACH_PROFILE_EXAMPLE, status: 'DRAFT', verificationStatus: 'UNVERIFIED', certifications: [] } },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid Bearer token.',
    schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict — this user already has a coach profile.',
    schema: { example: { statusCode: 409, message: 'A coach profile already exists for this user.', error: 'Conflict' } },
  })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateCoachProfileDto) {
    return this.coachProfileService.create(req.user.userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Get my own coach profile',
    description:
      'Returns the full coach profile of the currently logged-in user, including **bank information** and **all certifications** (regardless of verification status).\n\n' +
      'Use this to display the coach\'s own dashboard view.',
  })
  @ApiResponse({
    status: 200,
    description: 'Full coach profile with certifications.',
    schema: { example: COACH_PROFILE_EXAMPLE },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
    schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 404,
    description: 'The user has not registered as a coach yet.',
    schema: { example: { statusCode: 404, message: 'Coach profile not found. Please register as a coach first.', error: 'Not Found' } },
  })
  @HttpCode(HttpStatus.OK)
  getMyProfile(@Request() req: any) {
    return this.coachProfileService.findMyProfile(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Update my coach profile',
    description:
      'Updates any editable field on the coach\'s own profile. All fields are optional — only send the ones you want to change.\n\n' +
      'Includes bank information fields (`paymentAccountName`, `paymentAccountNumber`, `paymentBankName`, `paymentQrUrl`).\n\n' +
      'Can be called regardless of profile status (DRAFT, ACTIVE, SUSPENDED).',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
    schema: { example: { ...COACH_PROFILE_EXAMPLE, bio: 'Updated bio text.', updatedAt: '2026-06-26T15:00:00.000Z' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach profile not found.', schema: { example: { statusCode: 404, message: 'Coach profile not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  update(@Request() req: any, @Body() dto: UpdateCoachProfileDto) {
    return this.coachProfileService.update(req.user.userId, dto);
  }

  @Post('me/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Publish my profile — make it publicly visible',
    description:
      'Changes the coach\'s profile status from **DRAFT → ACTIVE**. After this call, the profile will appear in the public coach discovery list (`GET /api/coaches`).\n\n' +
      '**No admin approval is needed.** The coach self-publishes their profile at any time.\n\n' +
      'Certification verification status has no effect on whether a coach can publish.\n\n' +
      '**Returns 400** if the profile is already ACTIVE or SUSPENDED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile is now ACTIVE and visible to all users.',
    schema: { example: { ...COACH_PROFILE_EXAMPLE, status: 'ACTIVE' } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — profile is already active or suspended.', schema: { example: { statusCode: 400, message: 'Coach profile is already published.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach profile not found.', schema: { example: { statusCode: 404, message: 'Coach profile not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  publish(@Request() req: any) {
    return this.coachProfileService.publish(req.user.userId);
  }
}

// ─────────────────────────────────────
//  Public endpoints: /api/coaches
// ─────────────────────────────────────

@ApiTags('Coach Profile — Public Discovery')
@Controller('api/coaches')
export class PublicCoachController {
  constructor(
    private readonly coachProfileService: CoachProfileService,
    private readonly coachClassService: CoachClassService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '(Any) Discover coaches',
    description:
      'Returns a paginated list of **ACTIVE** coaches. Supports optional filters:\n\n' +
      '- `city` — filter by city (case-insensitive partial match)\n' +
      '- `level` — filter by level: `Beginner`, `Intermediate`, `Advanced`, `Pro`\n\n' +
      'Results are ordered by newest first (`createdAt` descending).\n\n' +
      '**No authentication required.**',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of active coaches.',
    schema: {
      example: {
        data: [COACH_PROFILE_PUBLIC_EXAMPLE],
        pagination: { page: 1, limit: 10, total: 42, totalPages: 5 },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  listPublic(@Query() query: ListCoachesQueryDto) {
    return this.coachProfileService.listPublic(query);
  }

  @Get(':coachId')
  @ApiOperation({
    summary: '(Any) Get a coach\'s public profile',
    description:
      'Returns the full public profile of a specific coach, including **all certifications** (with verification status) and **bank information** (needed for learners to know where to pay).\n\n' +
      'Only ACTIVE coaches are returned. If the coach has set their profile to DRAFT or is SUSPENDED, this returns 404.\n\n' +
      '**No authentication required.**',
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID.', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Public coach profile with verified certifications and bank info.',
    schema: { example: COACH_PROFILE_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Coach not found or not publicly available.', schema: { example: { statusCode: 404, message: 'Coach not found or not publicly available.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  findOnePublic(@Param('coachId', ParseUUIDPipe) coachId: string) {
    return this.coachProfileService.findOnePublic(coachId);
  }

  @Get(':coachId/classes')
  @ApiOperation({
    summary: '(Any) List open classes for a specific coach',
    description:
      'Returns all **OPEN** and **ONGOING** classes for a specific coach. Useful for displaying a coach\'s active offerings on their public profile page.\n\n' +
      'Each result includes the first 3 upcoming schedule entries for quick preview.\n\n' +
      '**No authentication required.**',
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID.', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'List of OPEN and ONGOING classes for this coach.',
    schema: {
      example: [
        {
          id: 'f0000001-f000-4000-8000-000000000001',
          coachProfileId: 'c0000001-c000-4000-8000-000000000001',
          title: 'Pickleball Beginner Boot Camp',
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
          schedules: [
            { id: 'e0000001-e000-4000-8000-000000000001', classId: 'f0000001-f000-4000-8000-000000000001', scheduledAt: '2026-07-19T09:00:00.000Z', durationMinutes: 90, topic: 'Giới thiệu môn Pickleball và quy tắc cơ bản', note: 'Mang giày thể thao.', createdAt: '2026-07-01T00:00:00.000Z' },
          ],
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Coach not found.', schema: { example: { statusCode: 404, message: 'Coach not found or not publicly available.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  async listCoachClasses(@Param('coachId', ParseUUIDPipe) coachId: string) {
    // Verify coach exists and is public
    await this.coachProfileService.findOnePublic(coachId);
    return this.coachClassService.listPublicByCoach(coachId);
  }
}
