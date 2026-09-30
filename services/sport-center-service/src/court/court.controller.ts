import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CourtService } from './court.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CenterOwnerGuard } from '../guards/center-owner.guard';

@ApiTags('Courts')
@Controller('sport-centers/:centerId/courts')
export class CourtController {
  constructor(private readonly courtService: CourtService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create court in sport center',
    description: 'Creates a child court under the given sport center.',
  })
  @ApiBody({ type: CreateCourtDto })
  @ApiResponse({
    status: 201,
    description: 'Court created successfully.',
    schema: {
      example: {
        id: 'e3bc6784-b972-4e92-9b01-f21ddb56dd63',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'San 1',
        type: 'INDOOR',
        status: 'ACTIVE',
        createdAt: '2026-04-04T08:00:00.000Z',
        updatedAt: '2026-04-04T08:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard, CenterOwnerGuard)
  create(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() createCourtDto: CreateCourtDto,
  ) {
    return this.courtService.create(centerId, createCourtDto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List courts by sport center',
    description: 'Returns all courts belonging to the given sport center.',
  })
  @ApiResponse({
    status: 200,
    description: 'Court list fetched successfully.',
    schema: {
      example: [
        {
          id: 'e3bc6784-b972-4e92-9b01-f21ddb56dd63',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          name: 'San 1',
          type: 'INDOOR',
          status: 'ACTIVE',
          createdAt: '2026-04-04T08:00:00.000Z',
          updatedAt: '2026-04-04T08:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  findAllByCenter(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
  ) {
    return this.courtService.findAllByCenter(centerId);
  }

  @Patch(':courtId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update court',
    description: 'Partially updates a court under the given sport center.',
  })
  @ApiBody({ type: UpdateCourtDto })
  @ApiResponse({
    status: 200,
    description: 'Court updated successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Sport center or court not found.' })
  @UseGuards(JwtAuthGuard, CenterOwnerGuard)
  update(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('courtId', new ParseUUIDPipe()) courtId: string,
    @Body() updateCourtDto: UpdateCourtDto,
  ) {
    return this.courtService.update(centerId, courtId, updateCourtDto);
  }

  @Delete(':courtId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Archive court',
    description: 'Soft-deletes a court by transitioning status to ARCHIVED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Court archived successfully.',
    schema: {
      example: {
        id: 'e3bc6784-b972-4e92-9b01-f21ddb56dd63',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'San 1',
        type: 'INDOOR',
        status: 'ARCHIVED',
        createdAt: '2026-04-04T08:00:00.000Z',
        updatedAt: '2026-04-04T08:15:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Sport center or court not found.' })
  @UseGuards(JwtAuthGuard, CenterOwnerGuard)
  archive(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('courtId', new ParseUUIDPipe()) courtId: string,
  ) {
    return this.courtService.archive(centerId, courtId);
  }
}
