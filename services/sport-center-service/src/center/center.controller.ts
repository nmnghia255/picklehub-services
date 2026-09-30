import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CenterService } from './center.service';
import { CreateCenterDto } from './dto/create-center.dto';
import { ListCenterQueryDto } from './dto/list-center-query.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { CreateCenterPriceSlotDto } from './dto/create-center-price-slot.dto';
import { UpdateCenterPriceSlotsDto } from './dto/update-center-price-slots.dto';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalServiceGuard } from '../guards/internal-service.guard';

@ApiTags('Sport Centers')
@Controller('sport-centers')
export class CenterController {
  constructor(private readonly centerService: CenterService) { }

  //--------------------------------------------------
  // Api support for Owner-specific operations
  //--------------------------------------------------

  // Create a new sport center.
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create sport center',
    description: 'Creates a new sport center aggregate.',
  })
  @ApiBody({ type: CreateCenterDto })
  @ApiResponse({
    status: 201,
    description: 'Sport center created successfully.',
    schema: {
      example: {
        id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        ownerId: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
        name: 'PickleHub District 1',
        address: '123 Nguyen Hue, District 1, Ho Chi Minh City',
        phone: '+84901234567',
        email: 'hello@pickledome.com',
        openTime: '06:00',
        closeTime: '22:00',
        basePrice: 80000,
        status: 'INACTIVE',
        amenities: ['Parking', 'Shower', 'Cafe'],
        images: ['https://example.com/image1.jpg'],
        rules: ['Please arrive 10 mins early', 'Non-marking shoes only'],
        description: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
        paymentAccountName: 'NGUYEN VAN AN',
        paymentAccountNumber: '1234567890',
        paymentBankName: 'VietcomBank',
        paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
        createdAt: '2026-04-04T08:00:00.000Z',
        updatedAt: '2026-04-04T08:00:00.000Z',
        deletedAt: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createCenterDto: CreateCenterDto) {
    // Get ownerId from token
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.centerService.create(ownerId, createCenterDto);
  }

  // List ACTIVE sport centers with pagination and optional status filter for users.
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List sport centers for users',
    description: 'Returns active sport center list with limit/offset pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sport center list fetched successfully. Set favouritesOnly=true to return only centres favourited by the current user.',
    schema: {
      example: {
        data: [
          {
            id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            ownerId: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
            name: 'PickleHub District 1',
            address: '123 Nguyen Hue, District 1, Ho Chi Minh City',
            phone: '+84901234567',
            email: 'hello@pickledome.com',
            openTime: '06:00',
            closeTime: '22:00',
            basePrice: 80000,
            status: 'ACTIVE',
            amenities: ['Parking', 'Shower', 'Cafe'],
            images: ['https://example.com/image1.jpg'],
            rules: ['Please arrive 10 mins early', 'Non-marking shoes only'],
            description: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
            paymentAccountName: 'NGUYEN VAN AN',
            paymentAccountNumber: '1234567890',
            paymentBankName: 'VietcomBank',
            paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
            createdAt: '2026-04-04T08:00:00.000Z',
            updatedAt: '2026-04-04T08:00:00.000Z',
            deletedAt: null,
            services: [
              {
                id: '550e8400-e29b-41d4-a716-446655440001',
                centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
                name: 'Racket Rental',
                type: 'EQUIPMENT_RENTAL',
                price: 25000,
                unit: 'VND / 3h',
                imageUrl: 'https://cdn.example.com/services/racket-rental.png',
                isActive: true,
              }
            ],
            products: [
              {
                id: '550e8400-e29b-41d4-a716-446655440010',
                centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
                name: 'Pocari Sweat 500ml',
                type: 'BEVERAGE',
                price: 25000,
                unit: 'VND / bottle',
                imageUrl: 'https://cdn.example.com/products/pocari.png',
                stock: 100,
                isActive: true,
              }
            ],
            _count: {
              courts: 8
            },
            averageRating: 4.5,
            reviewCount: 12,
            isFavourite: true
          },
        ],
        pagination: {
          limit: 20,
          offset: 0,
          total: 1,
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  findActive(@Req() req: any, @Query() query: ListCenterQueryDto) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.centerService.findActive(query, userId);
  }

  // List all sport centers for ADMIN.
  @Get('all')
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: 'List all sport centers',
    description: 'Returns a list of all sport centers',
  })
  @ApiResponse({
    status: 200,
    description: 'Sport center list fetched successfully.',
    schema: {
      example: {
        data: [
          {
            id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            ownerId: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
            name: 'PickleHub District 1',
            address: '123 Nguyen Hue, District 1, Ho Chi Minh City',
            phone: '+84901234567',
            email: 'hello@pickledome.com',
            openTime: '06:00',
            closeTime: '22:00',
            basePrice: 80000,
            status: 'ACTIVE',
            amenities: ['Parking', 'Shower', 'Cafe'],
            images: ['https://example.com/image1.jpg'],
            rules: ['Please arrive 10 mins early', 'Non-marking shoes only'],
            description: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
            paymentAccountName: 'NGUYEN VAN AN',
            paymentAccountNumber: '1234567890',
            paymentBankName: 'VietcomBank',
            paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
            createdAt: '2026-04-04T08:00:00.000Z',
            updatedAt: '2026-04-04T08:00:00.000Z',
            deletedAt: null,
            services: [
              {
                id: '550e8400-e29b-41d4-a716-446655440001',
                centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
                name: 'Racket Rental',
                type: 'EQUIPMENT_RENTAL',
                price: 25000,
                unit: 'VND / 3h',
                imageUrl: 'https://cdn.example.com/services/racket-rental.png',
                isActive: true,
              }
            ],
            products: [
              {
                id: '550e8400-e29b-41d4-a716-446655440010',
                centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
                name: 'Pocari Sweat 500ml',
                type: 'BEVERAGE',
                price: 25000,
                unit: 'VND / bottle',
                imageUrl: 'https://cdn.example.com/products/pocari.png',
                stock: 100,
                isActive: true,
              }
            ],
            _count: {
              courts: 8
            },
            averageRating: 4.5,
            reviewCount: 12
          },
        ],
      },
    },
  })
  @UseGuards(InternalServiceGuard)
  findAll(@Query() query: ListCenterQueryDto) {
    return this.centerService.findAll(query);
  }

  // Get centers by ownerId is a common use case that can be optimized with an indexed query.
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List sport centers by owner',
    description: 'Returns sport centers owned by a specific user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sport centers fetched successfully.',
    schema: {
      example: [
        {
          id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          ownerId: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
          name: 'PickleHub District 1',
          address: '123 Nguyen Hue, District 1, Ho Chi Minh City',
          phone: '+84901234567',
          email: 'hello@pickledome.com',
          openTime: '06:00',
          closeTime: '22:00',
          basePrice: 80000,
          status: 'ACTIVE',
          amenities: ['Parking', 'Shower', 'Cafe'],
          images: ['https://example.com/image1.jpg'],
          rules: ['Please arrive 10 mins early', 'Non-marking shoes only'],
          description: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
          paymentAccountName: 'NGUYEN VAN AN',
          paymentAccountNumber: '1234567890',
          paymentBankName: 'VietcomBank',
          paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
          createdAt: '2026-04-04T08:00:00.000Z',
          updatedAt: '2026-04-04T08:00:00.000Z',
          deletedAt: null,
          services: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
              name: 'Racket Rental',
              type: 'EQUIPMENT_RENTAL',
              price: 25000,
              unit: 'VND / 3h',
              imageUrl: 'https://cdn.example.com/services/racket-rental.png',
              isActive: true,
              createdAt: '2026-05-20T10:00:00.000Z',
              updatedAt: '2026-05-20T10:00:00.000Z',
            },
          ],
          products: [
            {
              id: '550e8400-e29b-41d4-a716-446655440010',
              centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
              name: 'Pocari Sweat 500ml',
              description: 'Refreshing sports drink',
              type: 'BEVERAGE',
              price: 25000,
              unit: 'VND / bottle',
              imageUrl: 'https://cdn.example.com/products/pocari.png',
              stock: 100,
              isActive: true,
              createdAt: '2026-05-20T10:00:00.000Z',
              updatedAt: '2026-05-20T10:00:00.000Z',
            },
          ],
          _count: {
            courts: 8,
          },
          averageRating: 4.5,
          reviewCount: 12,
          isFavourite: false,
        },
      ],
    },
  })
  @UseGuards(JwtAuthGuard)
  findByOwnerId(@Req() req: any) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.centerService.findByOwnerId(ownerId, ownerId);
  }

  // Get center details by centerId is a common operation that can be optimized with an indexed query.
  @Get(':centerId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get sport center detail',
    description: 'Returns details of a sport center by centerId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sport center detail fetched successfully.',
    schema: {
      example: {
        id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        ownerId: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
        name: 'PickleHub District 1',
        address: '123 Nguyen Hue, District 1, Ho Chi Minh City',
        phone: '+84901234567',
        email: 'hello@pickledome.com',
        openTime: '06:00',
        closeTime: '22:00',
        basePrice: 80000,
        status: 'ACTIVE',
        amenities: ['Parking', 'Shower', 'Cafe'],
        images: ['https://example.com/image1.jpg'],
        rules: ['Please arrive 10 mins early', 'Non-marking shoes only'],
        description: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
        paymentAccountName: 'NGUYEN VAN AN',
        paymentAccountNumber: '1234567890',
        paymentBankName: 'VietcomBank',
        paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
        createdAt: '2026-04-04T08:00:00.000Z',
        updatedAt: '2026-04-04T08:00:00.000Z',
        deletedAt: null,
        priceSlots: [
          {
            id: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
            centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            startTime: '06:00',
            endTime: '12:00',
            pricePerHour: 80000,
            createdAt: '2026-05-06T08:00:00.000Z',
            updatedAt: '2026-05-06T08:00:00.000Z',
          }
        ],
        services: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            name: 'Racket Rental',
            description: 'Rent a professional pickleball racket',
            type: 'EQUIPMENT_RENTAL',
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
            price: 150000,
            unit: 'VND / session',
            isActive: true,
            createdAt: '2026-05-20T10:00:00.000Z',
            updatedAt: '2026-05-20T10:00:00.000Z',
          }
        ],
        products: [
          {
            id: '550e8400-e29b-41d4-a716-446655440010',
            centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            name: 'Pocari Sweat 500ml',
            description: 'Refreshing sports drink',
            type: 'BEVERAGE',
            price: 25000,
            unit: 'VND / bottle',
            stock: 100,
            isActive: true,
            createdAt: '2026-05-20T10:00:00.000Z',
            updatedAt: '2026-05-20T10:00:00.000Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440011',
            centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            name: 'Rivive Drink 500ml',
            description: 'Energy drink for athletes',
            type: 'BEVERAGE',
            price: 15000,
            unit: 'VND / bottle',
            stock: 50,
            isActive: true,
            createdAt: '2026-05-20T10:00:00.000Z',
            updatedAt: '2026-05-20T10:00:00.000Z',
          }
        ],
        _count: {
          courts: 8
        },
        averageRating: 4.5,
        reviewCount: 12,
        isFavourite: true
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: any, @Param('centerId', new ParseUUIDPipe()) centerId: string) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.centerService.findOne(centerId, userId);
  }

  // Update center details by centerId.
  @Patch(':centerId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update sport center',
    description: 'Partially updates a sport center by centerId.',
  })
  @ApiBody({ type: UpdateCenterDto })
  @ApiResponse({
    status: 200,
    description: 'Sport center updated successfully.',
    schema: {
      example: {
        id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        ownerId: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
        name: 'PickleHub District 1',
        address: '123 Nguyen Hue, District 1, Ho Chi Minh City',
        phone: '+84901234567',
        email: 'hello@pickledome.com',
        openTime: '06:00',
        closeTime: '22:00',
        basePrice: 80000,
        status: 'ACTIVE',
        amenities: ['Parking', 'Shower', 'Cafe'],
        images: ['https://example.com/image1.jpg'],
        rules: ['Please arrive 10 mins early', 'Non-marking shoes only'],
        description: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
        paymentAccountName: 'NGUYEN VAN AN',
        paymentAccountNumber: '1234567890',
        paymentBankName: 'VietcomBank',
        paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
        createdAt: '2026-04-04T08:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
        deletedAt: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  update(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() updateCenterDto: UpdateCenterDto,
  ) {
    return this.centerService.update(centerId, updateCenterDto);
  }

  // Soft delete center by centerId.
  @Delete(':centerId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete sport center',
    description: 'Soft deletes a sport center by centerId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sport center deleted successfully.',
    schema: {
      example: {
        id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        ownerId: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
        name: 'PickleHub District 1',
        address: '123 Nguyen Hue, District 1, Ho Chi Minh City',
        phone: '+84901234567',
        email: 'hello@pickledome.com',
        openTime: '06:00',
        closeTime: '22:00',
        basePrice: 80000,
        status: 'ACTIVE',
        amenities: ['Parking', 'Shower', 'Cafe'],
        images: ['https://example.com/image1.jpg'],
        rules: ['Please arrive 10 mins early', 'Non-marking shoes only'],
        description: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
        paymentAccountName: 'NGUYEN VAN AN',
        paymentAccountNumber: '1234567890',
        paymentBankName: 'VietcomBank',
        paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
        createdAt: '2026-04-04T08:00:00.000Z',
        updatedAt: '2026-05-20T10:05:00.000Z',
        deletedAt: '2026-05-20T10:05:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
  ) {
    return this.centerService.remove(centerId);
  }

  // Add a price slot to a center
  @Post(':centerId/price-slots')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Add a price slot',
    description: 'Adds a price slot for a specific center.',
  })
  @ApiBody({ type: CreateCenterPriceSlotDto })
  @ApiResponse({
    status: 201,
    description: 'Price slot created successfully.',
    schema: {
      example: {
        id: 'b7e6b1fb-e960-5c82-bb45-78d3f779g8b5',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        startTime: '06:00',
        endTime: '12:00',
        pricePerHour: 80000,
        createdAt: '2026-05-06T08:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Center not found.' })
  @UseGuards(JwtAuthGuard)
  createPriceSlot(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() dto: CreateCenterPriceSlotDto,
  ) {
    return this.centerService.createPriceSlot(centerId, dto);
  }

  // Get price slots for a center
  @Get(':centerId/price-slots')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get price slots',
    description: 'Returns all price slots for a specific center.',
  })
  @ApiResponse({
    status: 200,
    description: 'Price slots fetched successfully.',
    schema: {
      example: [
        {
          id: 'b7d5a0ea-d859-4b71-aa34-67c2e668f7a4',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          startTime: '06:00',
          endTime: '12:00',
          pricePerHour: 80000,
          createdAt: '2026-05-06T08:00:00.000Z',
          updatedAt: '2026-05-06T08:00:00.000Z',
        },
        {
          id: 'c8e6b1fb-e960-5c82-bb45-78d3f779g8b5',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          startTime: '12:00',
          endTime: '18:00',
          pricePerHour: 120000,
          createdAt: '2026-05-06T08:00:00.000Z',
          updatedAt: '2026-05-06T08:00:00.000Z',
        }
      ],
    },
  })
  getPriceSlots(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
  ) {
    return this.centerService.getPriceSlots(centerId);
  }

  // Update price slots in bulk
  @Patch(':centerId/price-slots')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update price slots in bulk',
    description: 'Replaces all price slots for a specific center.',
  })
  @ApiBody({ type: UpdateCenterPriceSlotsDto })
  @ApiResponse({
    status: 200,
    description: 'Price slots updated successfully.',
  })
  @ApiResponse({ status: 404, description: 'Center not found.' })
  @UseGuards(JwtAuthGuard)
  updatePriceSlots(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() dto: UpdateCenterPriceSlotsDto,
  ) {
    return this.centerService.updatePriceSlots(centerId, dto);
  }

  // Delete a price slot
  @Delete(':centerId/price-slots/:slotId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a price slot',
    description: 'Deletes a price slot for a specific center.',
  })
  @ApiResponse({
    status: 200,
    description: 'Price slot deleted successfully.',
    schema: {
      example: {
        id: 'b7e6b1fb-e960-5c82-bb45-78d3f779g8b5',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        startTime: '06:00',
        endTime: '12:00',
        pricePerHour: 80000,
        createdAt: '2026-05-06T08:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Price slot not found.' })
  @UseGuards(JwtAuthGuard)
  deletePriceSlot(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('slotId', new ParseUUIDPipe()) slotId: string,
  ) {
    return this.centerService.deletePriceSlot(centerId, slotId);
  }

  // ─────────────────────────────────────────────────────────────
  // Cancellation policy
  // ─────────────────────────────────────────────────────────────

  @Get(':centerId/cancellation-policy')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get cancellation policy',
    description:
      'Returns the preservation credit cancellation policy for a sport center: ' +
      'whether player-initiated cancellations are allowed and the refund tiers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cancellation policy fetched successfully.',
    schema: {
      example: {
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        allowCancellation: true,
        tiers: [
          { id: 'uuid-1', centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', minDaysBeforeStart: 2, refundPercent: 100 },
          { id: 'uuid-2', centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', minDaysBeforeStart: 1, refundPercent: 75 },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  getCancellationPolicy(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
  ) {
    return this.centerService.getCancellationPolicy(centerId);
  }

  @Patch(':centerId/cancellation-policy')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update cancellation policy (owner action)',
    description:
      'Replaces the cancellation policy for a sport center. ' +
      'Only the owning user may update this. ' +
      'Tiers are fully replaced when provided — pass an empty array to clear all tiers. ' +
      'Example: [{ minDaysBeforeStart: 2, refundPercent: 100 }, { minDaysBeforeStart: 1, refundPercent: 75 }] ' +
      'means: cancel >=2 days ahead -> 100% credit; cancel >=1 day ahead -> 75%; cancel <1 day -> 0%.',
  })
  @ApiBody({ type: UpdateCancellationPolicyDto })
  @ApiResponse({
    status: 200,
    description: 'Cancellation policy updated successfully.',
    schema: {
      example: {
        id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        allowCancellation: true,
        cancellationTiers: [
          { id: 'uuid-1', centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', minDaysBeforeStart: 2, refundPercent: 100 },
          { id: 'uuid-2', centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', minDaysBeforeStart: 1, refundPercent: 75 },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Caller is not the owner.' })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  updateCancellationPolicy(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() dto: UpdateCancellationPolicyDto,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.centerService.updateCancellationPolicy(centerId, ownerId, dto);
  }

  // ────────────────────────────────────────────────────────────
  // Owner: preservation credit visibility
  // ────────────────────────────────────────────────────────────

  @Get(':centerId/credits')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List player credit wallets (owner)',
    description:
      'Returns all preservation credit wallets held by players at this sport center. ' +
      'Also returns `totalOutstandingCredit` — the sum of all balances, ' +
      'which represents the total credit liability the center owes to players.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Credit wallets listed successfully.',
    schema: {
      example: {
        data: [
          {
            id: 'wallet-uuid-1',
            playerId: 'user-uuid-1234',
            centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            balance: 315000,
            transactions: [
              {
                id: 'tx-uuid-1',
                bookingId: 'booking-uuid-1',
                amount: 315000,
                type: 'CANCELLATION_REFUND',
                description: '100% preservation credit refund — owner-initiated cancellation',
                createdAt: '2026-05-22T10:00:00.000Z',
                booking: {
                  id: 'booking-uuid-1',
                  date: '2026-05-20T00:00:00.000Z',
                  startTime: '17:00',
                  endTime: '19:00',
                  status: 'CANCELLED',
                  totalPrice: 315000,
                  creditApplied: 0,
                  paymentRemaining: 0,
                  center: { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
                  bookingItems: [
                    { startTime: '17:00', endTime: '18:00', itemPrice: 157500, court: { id: 'court-uuid-1', name: 'Court 1' } },
                    { startTime: '18:00', endTime: '19:00', itemPrice: 157500, court: { id: 'court-uuid-1', name: 'Court 1' } },
                  ],
                }
              }
            ],
            updatedAt: '2026-05-22T10:00:00.000Z',
          },
          {
            id: 'wallet-uuid-2',
            playerId: 'user-uuid-5678',
            centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            balance: 120000,
            transactions: [
              {
                id: 'tx-uuid-2',
                bookingId: 'booking-uuid-2',
                amount: -120000,
                type: 'BOOKING_PAYMENT',
                description: 'Preservation credit applied to booking',
                createdAt: '2026-05-21T08:00:00.000Z',
                booking: {
                  id: 'booking-uuid-2',
                  date: '2026-05-21T00:00:00.000Z',
                  startTime: '08:00',
                  endTime: '10:00',
                  status: 'PENDING',
                  totalPrice: 320000,
                  creditApplied: 120000,
                  paymentRemaining: 200000,
                  center: { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
                  bookingItems: [
                    { startTime: '08:00', endTime: '09:00', itemPrice: 160000, court: { id: 'court-uuid-2', name: 'Court 2' } },
                    { startTime: '09:00', endTime: '10:00', itemPrice: 160000, court: { id: 'court-uuid-2', name: 'Court 2' } },
                  ],
                }
              }
            ],
            updatedAt: '2026-05-21T08:00:00.000Z',
          },
        ],
        totalOutstandingCredit: 435000,
        pagination: { limit: 20, offset: 0, total: 2 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Caller is not the owner.' })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  getCenterCreditWallets(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.centerService.getCenterCreditWallets(
      centerId,
      ownerId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':centerId/credits/:playerId/transactions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get player credit transaction history (owner)',
    description:
      'Returns the full preservation credit transaction history for a specific player at this center. ' +
      'Useful for owner support and dispute resolution.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Transaction history fetched successfully.',
    schema: {
      example: {
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        centerName: 'Pickle Dome Sukhumvit',
        playerId: 'user-uuid-1234',
        balance: 315000,
        transactions: [
          {
            id: 'tx-uuid-1',
            bookingId: 'booking-uuid-1',
            amount: 315000,
            type: 'CANCELLATION_REFUND',
            description: '100% preservation credit refund — owner-initiated cancellation',
            createdAt: '2026-05-22T10:00:00.000Z',
            booking: {
              id: 'booking-uuid-1',
              date: '2026-05-20T00:00:00.000Z',
              startTime: '17:00',
              endTime: '19:00',
              status: 'CANCELLED',
              totalPrice: 315000,
              creditApplied: 0,
              paymentRemaining: 0,
              center: { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
              bookingItems: [
                { startTime: '17:00', endTime: '18:00', itemPrice: 157500, court: { id: 'court-uuid-1', name: 'Court 1' } },
                { startTime: '18:00', endTime: '19:00', itemPrice: 157500, court: { id: 'court-uuid-1', name: 'Court 1' } },
              ],
            }
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Caller is not the owner.' })
  @ApiResponse({ status: 404, description: 'Sport center not found.' })
  @UseGuards(JwtAuthGuard)
  getPlayerCreditTransactions(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.centerService.getPlayerCreditTransactionsForOwner(
      centerId,
      ownerId,
      playerId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}

