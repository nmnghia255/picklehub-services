import { Controller, Get, Param, ParseUUIDPipe, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequireSubscription } from '../guards/subscription.guard';
import { DashboardService } from './dashboard.service';

const dashboardOverviewExample = {
  facility: {
    totalCenters: 2,
    totalCourts: 12
  },
  customers: {
    totalUniqueCustomers: 342,
    globalAverageRating: 4.8,
    totalReviews: 156
  },
  bookings: {
    total: 1250,
    pending: 15,
    confirmed: 42,
    completed: 1150,
    cancelled: 43
  },
  revenue: {
    settled: 12500000,
    pending: 315000
  }
};

@ApiTags('Owner Dashboard')
@Controller('sport-centers/owner/dashboard')
@RequireSubscription('SPORT_CENTER_MANAGER')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get owner dashboard overview',
    description: 'Returns aggregated statistics across all sport centers owned by the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview fetched successfully.',
    schema: { example: dashboardOverviewExample },
  })
  @UseGuards(JwtAuthGuard)
  getOverview(@Req() req: any) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException('Unable to identify current user');
    return this.dashboardService.getOwnerDashboardOverview(ownerId);
  }

  @Get('overview/:centerId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get specific sport center dashboard overview',
    description: 'Returns aggregated statistics for a specific sport center owned by the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview fetched successfully.',
    schema: { example: { ...dashboardOverviewExample, facility: { totalCenters: 1, totalCourts: 6 } } },
  })
  @ApiResponse({ status: 403, description: 'User does not own this sport center.' })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  getCenterOverview(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException('Unable to identify current user');
    return this.dashboardService.getCenterDashboardOverview(ownerId, centerId);
  }
}
