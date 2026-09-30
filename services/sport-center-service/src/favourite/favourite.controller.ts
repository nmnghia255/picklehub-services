import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FavouriteService } from './favourite.service';
import { CreateFavouriteDto } from './dto/create-favourite.dto';
import { FavouriteResponseDto } from './dto/favourite-response.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Favourites')
@Controller('sport-centers/favourites')
export class FavouriteController {
  constructor(private readonly favouriteService: FavouriteService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add a sport center to favourites' })
  @ApiResponse({
    status: 201,
    description: 'Favourited successfully.',
    type: FavouriteResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      centerId: '660e8400-e29b-41d4-a716-446655440000',
      userId: '770e8400-e29b-41d4-a716-446655440000',
      createdAt: '2024-05-21T10:30:00.000Z',
    },
  })
  @UseGuards(JwtAuthGuard)
  add(@Req() req: any, @Body() dto: CreateFavouriteDto) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.favouriteService.add(userId, dto.centerId);
  }

  @Delete(':centerId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove a sport center from favourites' })
  @ApiResponse({
    status: 200,
    description: 'Removed from favourites successfully.',
    type: FavouriteResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      centerId: '660e8400-e29b-41d4-a716-446655440000',
      userId: '770e8400-e29b-41d4-a716-446655440000',
      createdAt: '2024-05-21T10:30:00.000Z',
    },
  })
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('centerId', new ParseUUIDPipe()) centerId: string) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.favouriteService.remove(userId, centerId);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get current user's favourite sport centers (full details)" })
  @ApiResponse({
    status: 200,
    description: 'Favourites fetched successfully. Response matches GET /api/sport-centers.',
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
  findMyFavourites(@Req() req: any) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.favouriteService.findMyFavourites(userId);
  }

  @Get('status/:centerId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Check if a sport center is favourited by the current user' })
  @ApiResponse({
    status: 200,
    description: 'Status checked successfully.',
    example: { isFavourite: true },
  })
  @UseGuards(JwtAuthGuard)
  checkStatus(@Req() req: any, @Param('centerId', new ParseUUIDPipe()) centerId: string) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.favouriteService.checkStatus(userId, centerId);
  }
}
