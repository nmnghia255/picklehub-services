import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Services')
@Controller('sport-centers/:centerId/services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  /**
   * Create a new service (owner only)
   */
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create service',
    description: 'Create a new service offering (equipment rental, coaching, etc.) for a sport center. Owner only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Service created successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Racket Rental',
        description: 'Rent a professional pickleball racket',
        type: 'EQUIPMENT_RENTAL',
        imageUrl: 'https://cdn.example.com/services/racket-rental.png',
        price: 25000,
        unit: 'VND / 3h',
        isActive: true,
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - not center owner.' })
  @UseGuards(JwtAuthGuard)
  create(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Req() req: any,
    @Body() createServiceDto: CreateServiceDto,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.serviceService.create(centerId, ownerId, createServiceDto);
  }

  /**
   * List active services for a sport center (players/users)
   */
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List available services',
    description: 'Get all active services available at a sport center.',
  })
  @ApiResponse({
    status: 200,
    description: 'Services fetched successfully.',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          name: 'Racket Rental',
          description: 'Rent a professional pickleball racket',
          type: 'EQUIPMENT_RENTAL',
          imageUrl: 'https://cdn.example.com/services/racket-rental.png',
          price: 25000,
          unit: 'VND / 3h',
          isActive: true,
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          name: 'Pro Coaching Session',
          description: '30-minute coaching session with a pro',
          type: 'COACHING',
          imageUrl: 'https://cdn.example.com/services/coaching.png',
          price: 150000,
          isActive: true,
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
      ],
    },
  })
  @UseGuards(JwtAuthGuard)
  findByCenterId(@Param('centerId', new ParseUUIDPipe()) centerId: string) {
    return this.serviceService.findByCenterId(centerId);
  }

  /**
   * Update a service (owner only)
   */
  @Put(':serviceId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update service',
    description: 'Update a service offering. Owner only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service updated successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Racket Rental Plus',
        description: 'Premium racket rental with grip tape',
        type: 'EQUIPMENT_RENTAL',
        imageUrl: 'https://cdn.example.com/services/racket-rental-plus.png',
        price: 35000,
        unit: 'VND / 3h',
        isActive: true,
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - not center owner.' })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  @UseGuards(JwtAuthGuard)
  update(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Req() req: any,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.serviceService.update(centerId, ownerId, serviceId, updateServiceDto);
  }

  /**
   * Delete a service (owner only)
   */
  @Delete(':serviceId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete service',
    description: 'Delete a service offering. Owner only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service deleted successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Racket Rental',
        description: 'Rent a professional pickleball racket',
        type: 'EQUIPMENT_RENTAL',
        imageUrl: 'https://cdn.example.com/services/racket-rental.png',
        price: 25000,
        unit: 'VND / 3h',
        isActive: false,
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T11:10:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - not center owner.' })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  @UseGuards(JwtAuthGuard)
  delete(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Req() req: any,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.serviceService.delete(centerId, ownerId, serviceId);
  }
}
