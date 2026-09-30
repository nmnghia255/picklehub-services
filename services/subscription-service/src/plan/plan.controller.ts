import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { ListPlansQueryDto } from './dto/list-plans.query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';

const PLAN_EXAMPLE = {
  id: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
  type: 'GROUP_OWNER',
  billingCycle: 'MONTHLY',
  name: 'Gói Quản lý Hội nhóm - Tháng',
  description: 'Dành cho người dẫn đầu cộng đồng pickleball. Tạo và quản lý hội nhóm không giới hạn thành viên.',
  features: [
    'Tạo hội nhóm không giới hạn',
    'Quản lý thành viên & phân quyền',
    'Theo dõi quỹ nhóm & chi tiêu',
    'Tổ chức hoạt động nhóm',
    'Gửi thông báo cho thành viên',
  ],
  priceVnd: 99000,
  durationInDays: 30,
  isActive: true,
  sortOrder: 20,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  isSubscribed: false,
};

@ApiTags('Plans')
@Controller('api/subscriptions/plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({
    summary: 'List all available service packages (Gói dịch vụ)',
    description:
      'Returns all **active** plans. Optionally filter by `type` and/or `billingCycle`.\n\n' +
      '**Plan types:**\n' +
      '- `SPORT_CENTER_MANAGER` — For court/sport center owners\n' +
      '- `GROUP_OWNER` — For group community leaders\n' +
      '- `SOCIAL_HOST` — For social play session organizers\n' +
      '- `TOURNAMENT_ORGANIZER` — For tournament directors\n' +
      '- `COACH` - For coaches\n\n' +
      '**Billing cycles:** `MONTHLY`, `QUARTERLY`, `YEARLY`\n\n' +
      '**Auth optional:** If an access token is provided, the response will include `isSubscribed` flag indicating if the current user has an active subscription for each plan.',
  })
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'List of active plans ordered by `sortOrder` ascending.',
    schema: {
      example: [
        {
          id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
          type: 'SPORT_CENTER_MANAGER',
          billingCycle: 'MONTHLY',
          name: 'Gói Quản lý Sân Thể thao - Tháng',
          description: 'Dành cho chủ sân pickleball. Quản lý sân, lịch đặt sân và thu chi hiệu quả.',
          features: [
            'Đăng ký & quản lý hồ sơ sân',
            'Nhận đặt sân trực tuyến',
            'Quản lý lịch sân theo giờ',
            'Báo cáo doanh thu hàng tháng',
            'Hỗ trợ tối đa 10 sân',
          ],
          priceVnd: 299000,
          durationInDays: 30,
          isActive: true,
          sortOrder: 10,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
          isSubscribed: true,
        },
        PLAN_EXAMPLE,
        {
          id: 'c2d5e8f1-4a6b-7c8d-9e0f-1a2b3c4d5e6f',
          type: 'SOCIAL_HOST',
          billingCycle: 'MONTHLY',
          name: 'Gói Tổ chức Giao lưu - Tháng',
          description: 'Dành cho người tổ chức buổi chơi giao lưu xã hội.',
          features: [
            'Tạo buổi chơi giao lưu (Social Play)',
            'Ghép đôi tự động thông minh',
            'Quản lý danh sách chờ',
          ],
          priceVnd: 149000,
          durationInDays: 30,
          isActive: true,
          sortOrder: 30,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
          isSubscribed: false,
        },
        {
          id: 'd3e6f9a2-5b7c-8d9e-0f1a-2b3c4d5e6f7a',
          type: 'TOURNAMENT_ORGANIZER',
          billingCycle: 'MONTHLY',
          name: 'Gói Tổ chức Giải đấu - Tháng',
          description: 'Dành cho ban tổ chức giải pickleball chuyên nghiệp.',
          features: [
            'Tạo & quản lý giải đấu',
            'Hệ thống bảng đấu & lịch thi đấu',
            'Đăng ký tham dự trực tuyến',
          ],
          priceVnd: 499000,
          durationInDays: 30,
          isActive: true,
          sortOrder: 40,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
          isSubscribed: false,
        },
        {
          id: 'e4f7a0b3-6c8d-9e0f-1a2b-3c4d5e6f7a8b',
          type: 'COACH',
          billingCycle: 'MONTHLY',
          name: 'Coach Subscription - Monthly',
          description: 'For coaches who want to publish a coach profile, create classes, manage teaching schedules, and receive learner bookings.',
          features: [
            'Create and publish a public coach profile',
            'Create group classes and recurring teaching schedules',
            'Accept private lesson bookings',
          ],
          priceVnd: 199000,
          durationInDays: 30,
          isActive: true,
          sortOrder: 50,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
          isSubscribed: false,
        },
      ],
    },
  })
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: ListPlansQueryDto, @Request() req: any) {
    return this.planService.findAll(query, req.user?.userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single plan by ID',
    description: 
      'Returns full detail of one plan (active or inactive).\n\n' +
      '**Auth optional:** If an access token is provided, the response will include `isSubscribed` flag.',
  })
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({
    name: 'id',
    description: 'Plan UUID.',
    example: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan detail.',
    schema: { example: PLAN_EXAMPLE },
  })
  @ApiResponse({
    status: 404,
    description: 'Plan not found.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Plan 7e4f1a2b-xxxx not found',
        error: 'Not Found',
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.planService.findOne(id, req.user?.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update a plan (admin only)',
    description:
      'Update mutable plan fields: `name`, `description`, `features`, `priceVnd`, `isActive`, `sortOrder`. ' +
      '`type`, `billingCycle`, and `durationInDays` cannot be changed after creation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Plan UUID.',
    example: '7e4f1a2b-3c5d-4e6f-8a9b-0c1d2e3f4a5b',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan updated successfully.',
    schema: {
      example: {
        ...PLAN_EXAMPLE,
        priceVnd: 129000,
        updatedAt: '2026-06-15T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid Bearer token.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Missing or invalid Authorization header',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — caller does not have the ADMIN role.',
    schema: {
      example: {
        statusCode: 403,
        message: 'Access denied. This endpoint requires the ADMIN role.',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Plan not found.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Plan 7e4f1a2b-xxxx not found',
        error: 'Not Found',
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.planService.update(id, dto);
  }
}
