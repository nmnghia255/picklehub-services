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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CoachCertificationService } from './coach-certification.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { ReviewCertificationDto } from './dto/review-certification.dto';
import { ListCertificationsQueryDto } from './dto/list-certifications-query.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireSubscription } from '../guards/subscription.guard';

// ─── Shared Swagger example objects ───
const CERT_EXAMPLE = {
  id: 'd0000001-d000-4000-8000-000000000001',
  coachProfileId: 'c0000001-c000-4000-8000-000000000001',
  name: 'USAPA Level 2 Instructor',
  issuingOrganization: 'USA Pickleball Association',
  issuedAt: '2024-03-15T00:00:00.000Z',
  expiresAt: null,
  documentUrl: 'https://cdn.picklehub.vn/certs/usapa-l2.pdf',
  verificationStatus: 'PENDING',
  reviewedByUserId: null,
  reviewNote: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const CERT_LIST_EXAMPLE = {
  data: [
    {
      ...CERT_EXAMPLE,
      coachProfile: {
        id: 'c0000001-c000-4000-8000-000000000001',
        displayName: 'Nguyễn Văn Coach',
        userId: 'a0000001-a000-4000-8000-000000000001',
      },
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

// ─────────────────────────────────────
//  Coach-side endpoints: /api/coach/certifications
// ─────────────────────────────────────

@ApiTags('Coach Certifications — Coach Actions')
@Controller('api/coach/certifications')
@RequireSubscription('COACH')
export class CoachCertificationController {
  constructor(private readonly certService: CoachCertificationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Add a certification to my profile',
    description:
      'Adds a coaching certification to the current coach\'s profile. The certification starts with `verificationStatus: PENDING` and will show a **pending badge** on the public profile until an admin reviews it.\n\n' +
      'Provide a URL to the certificate document. Users can upload a file via the **media-service** (`POST /api/media/documents` or `POST /api/media/images`), or simply paste an existing external link (e.g., Google Drive) to the `documentUrl` field.\n\n' +
      '**Note:** Certification verification status does NOT affect any coaching features. It is purely a UI trust badge.',
  })
  @ApiResponse({
    status: 201,
    description: 'Certification added. Status is PENDING until admin reviews.',
    schema: { example: CERT_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach profile not found — register as a coach first.', schema: { example: { statusCode: 404, message: 'Coach profile not found. Please register as a coach first.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.CREATED)
  addCertification(@Request() req: any, @Body() dto: CreateCertificationDto) {
    return this.certService.addCertification(req.user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) List my certifications',
    description:
      'Returns all certifications on the current coach\'s profile, including those that are `PENDING`, `VERIFIED`, or previously `REJECTED`.\n\n' +
      'Use this on the coach\'s own settings/profile management page.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of coach\'s certifications ordered by date added (newest first).',
    schema: {
      example: [
        CERT_EXAMPLE,
        { ...CERT_EXAMPLE, id: 'd0000002-d000-4000-8000-000000000002', name: 'Pickleball Canada National Coach', verificationStatus: 'VERIFIED', reviewNote: 'Documents verified.' },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 404, description: 'Coach profile not found.', schema: { example: { statusCode: 404, message: 'Coach profile not found. Please register as a coach first.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  listMyCertifications(@Request() req: any) {
    return this.certService.listMyCertifications(req.user.userId);
  }

  @Delete(':certId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Remove one of my certifications',
    description:
      'Permanently deletes a certification from the coach\'s profile. Only the coach who owns the certification can delete it.\n\n' +
      '**Returns 403** if the certification belongs to a different coach.',
  })
  @ApiParam({ name: 'certId', description: 'Certification UUID.', example: 'd0000001-d000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Certification removed successfully.',
    schema: { example: { message: 'Certification removed successfully.' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — certification belongs to another coach.', schema: { example: { statusCode: 403, message: 'You can only delete your own certifications.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Certification not found.', schema: { example: { statusCode: 404, message: 'Certification not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  removeCertification(
    @Request() req: any,
    @Param('certId', ParseUUIDPipe) certId: string,
  ) {
    return this.certService.removeCertification(req.user.userId, certId);
  }
}

// ─────────────────────────────────────
//  Admin endpoints: /api/admin/coaches/certifications
// ─────────────────────────────────────

@ApiTags('Coach Certifications — Admin')
@Controller('api/admin/coaches/certifications')
export class AdminCertificationController {
  constructor(private readonly certService: CoachCertificationService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Admin) List all certifications (with filters)',
    description:
      'Returns a paginated list of all coach certifications. Supports optional filters:\n\n' +
      '- `verificationStatus` — filter by status: `PENDING`, `VERIFIED`, `REJECTED`\n' +
      '- `coachProfileId` — filter by a specific coach profile\n\n' +
      'Results are ordered by newest first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of certifications with coach info.',
    schema: { example: CERT_LIST_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires ADMIN role.' })
  @HttpCode(HttpStatus.OK)
  listAll(@Query() query: ListCertificationsQueryDto) {
    return this.certService.listAllCertifications(query);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Admin) List all certifications pending review',
    description:
      'Returns all coach certifications that have `verificationStatus: PENDING`. Used by the admin panel to process certification review requests.\n\n' +
      'Each item includes the coach\'s `displayName` and `userId` for context.\n\n' +
      '**Note:** Approving or rejecting a certification only updates the UI badge — it has no effect on coach\'s ability to teach.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending certifications with coach info.',
    schema: {
      example: [
        {
          ...CERT_EXAMPLE,
          coachProfile: {
            id: 'c0000001-c000-4000-8000-000000000001',
            displayName: 'Nguyễn Văn Coach',
            userId: 'a0000001-a000-4000-8000-000000000001',
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — requires ADMIN role.', schema: { example: { statusCode: 403, message: 'Access denied. This endpoint requires the ADMIN role.', error: 'Forbidden' } } })
  @HttpCode(HttpStatus.OK)
  listPending() {
    return this.certService.listPendingCertifications();
  }

  @Patch(':certId/review')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Admin) Approve or reject a certification',
    description:
      'Updates a certification\'s `verificationStatus` to either `VERIFIED` or `REJECTED`. The reviewing admin\'s userId and an optional note are recorded.\n\n' +
      '- **VERIFIED** → the coach gets a ✅ verification badge on their public profile and on that certification.\n' +
      '- **REJECTED** → the badge shows ❌. The coach can re-upload corrected documents.\n\n' +
      '**This action has zero effect on what the coach can do** — features are always available.',
  })
  @ApiParam({ name: 'certId', description: 'Certification UUID.', example: 'd0000001-d000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Certification reviewed. verificationStatus updated.',
    schema: {
      example: {
        ...CERT_EXAMPLE,
        verificationStatus: 'VERIFIED',
        reviewedByUserId: 'a0000099-a000-4000-8000-000000000099',
        reviewNote: 'Documents look authentic.',
        updatedAt: '2026-06-26T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — requires ADMIN role.', schema: { example: { statusCode: 403, message: 'Access denied. This endpoint requires the ADMIN role.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Certification not found.', schema: { example: { statusCode: 404, message: 'Certification not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  reviewCertification(
    @Request() req: any,
    @Param('certId', ParseUUIDPipe) certId: string,
    @Body() dto: ReviewCertificationDto,
  ) {
    return this.certService.reviewCertification(req.user.userId, certId, dto);
  }
}
