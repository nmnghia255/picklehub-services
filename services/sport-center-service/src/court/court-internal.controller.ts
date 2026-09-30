import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { PrismaService } from '../prisma.service';

@ApiTags('internal')
@Controller('sport-centers/internal')
@UseGuards(InternalServiceGuard)
@ApiSecurity('internal-service-token')
export class CourtInternalController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Batch-fetch courts with their parent center info by a list of court IDs.
   * Returns: { id, name, type, status, centerId, centerName, centerAddress }
   * Called by match-service to enrich the courtId field in match responses.
   */
  @Post('courts/batch')
  async getBatchCourts(@Body() body: { courtIds: string[] }) {
    if (!body.courtIds || !Array.isArray(body.courtIds)) return [];

    const uniqueIds = Array.from(new Set(body.courtIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];

    const courts = await this.prisma.court.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        centerId: true,
        center: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });

    return courts.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      centerId: c.centerId,
      centerName: c.center.name,
      centerAddress: c.center.address,
    }));
  }

  @Post('centers/batch')
  async getBatchCenters(@Body() body: { centerIds: string[] }) {
    if (!body.centerIds || !Array.isArray(body.centerIds)) return [];

    const uniqueIds = Array.from(new Set(body.centerIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];

    const centers = await this.prisma.sportCenter.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });

    return centers.map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      latitude: c.latitude ? Number(c.latitude) : null,
      longitude: c.longitude ? Number(c.longitude) : null,
    }));
  }

  @Post('favourites/user')
  async getUserFavourites(@Body() body: { userId: string }) {
    if (!body.userId) return [];

    const favourites = await this.prisma.favourite.findMany({
      where: { userId: body.userId },
      select: {
        centerId: true,
      },
    });

    return favourites.map((f) => f.centerId);
  }
}
