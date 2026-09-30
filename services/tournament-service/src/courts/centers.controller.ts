import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CourtsService } from './courts.service';
import { AddCentersDto } from './dto/add-centers.dto';
import { CenterListResponseDto } from './dto/center-response.dto';

@ApiTags('Tournament Centers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller(':tournamentId/centers')
export class CentersController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get()
  @ApiOperation({
    summary: 'List selected centers',
    description: "Returns the tournament's selected sport centers, enriched with name/address/status and their courts.",
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({ status: 200, description: 'Centers retrieved successfully.', type: CenterListResponseDto })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  list(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Req() req: any,
  ): Promise<CenterListResponseDto> {
    return this.courtsService.listCenters(tournamentId, req.headers?.authorization);
  }

  @Post()
  @ApiOperation({
    summary: 'Add centers to the tournament',
    description: 'Adds one or more sport centers to the selection. Each id is validated against sport-center.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({ status: 201, description: 'Centers added successfully.', type: CenterListResponseDto })
  @ApiResponse({ status: 400, description: 'One or more centers do not exist.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  add(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() dto: AddCentersDto,
    @Req() req: any,
  ): Promise<CenterListResponseDto> {
    return this.courtsService.addCenters(tournamentId, dto.centerIds, req.headers?.authorization);
  }

  @Delete(':centerId')
  @ApiOperation({
    summary: 'Remove a center from the tournament',
    description: 'Removes a center from the selection. Blocked while any booking or linked match still references it.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'centerId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Center removed successfully.', type: CenterListResponseDto })
  @ApiResponse({ status: 400, description: 'Center still in use (cancel bookings / unlink matches first).' })
  @ApiResponse({ status: 404, description: 'Tournament not found, or center not selected.' })
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Req() req: any,
  ): Promise<CenterListResponseDto> {
    return this.courtsService.removeCenter(tournamentId, centerId, req.headers?.authorization);
  }
}
