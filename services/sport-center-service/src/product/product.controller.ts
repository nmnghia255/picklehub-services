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
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Products')
@Controller('sport-centers/:centerId/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Create a new product (owner only)
   */
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create product',
    description: 'Create a new product offering (beverages, consumables, etc.) for a sport center. Owner only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Pocari Sweat 500ml',
        description: 'Refreshing sports drink',
        type: 'BEVERAGE',
        imageUrl: 'https://cdn.example.com/products/pocari.png',
        price: 25000,
        unit: 'VND / bottle',
        stock: 100,
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
    @Body() createProductDto: CreateProductDto,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.productService.create(centerId, ownerId, createProductDto);
  }

  /**
   * List active products for a sport center (players/users)
   */
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List available products',
    description: 'Get all active products available for purchase at a sport center.',
  })
  @ApiResponse({
    status: 200,
    description: 'Products fetched successfully.',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          name: 'Pocari Sweat 500ml',
          description: 'Refreshing sports drink',
          type: 'BEVERAGE',
          imageUrl: 'https://cdn.example.com/products/pocari.png',
          price: 25000,
          unit: 'VND / bottle',
          stock: 100,
          isActive: true,
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          name: 'PickleHub Training Shirt',
          description: 'Moisture-wicking performance training shirt',
          type: 'CLOTHING',
          imageUrl: 'https://cdn.example.com/products/training-shirt.png',
          price: 350000,
          unit: 'VND / piece',
          stock: 50,
          isActive: true,
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
      ],
    },
  })
  @UseGuards(JwtAuthGuard)
  findByCenterId(@Param('centerId', new ParseUUIDPipe()) centerId: string) {
    return this.productService.findByCenterId(centerId);
  }

  /**
   * Update a product (owner only)
   */
  @Put(':productId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update product',
    description: 'Update a product offering. Owner only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440010',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Pocari Sweat 500ml',
        description: 'Refreshing sports drink',
        type: 'BEVERAGE',
        imageUrl: 'https://cdn.example.com/products/pocari.png',
        price: 25000,
        unit: 'VND / bottle',
        stock: 95,
        isActive: true,
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - not center owner.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  @UseGuards(JwtAuthGuard)
  update(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Req() req: any,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.productService.update(centerId, ownerId, productId, updateProductDto);
  }

  /**
   * Delete a product (owner only)
   */
  @Delete(':productId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete product',
    description: 'Delete a product offering. Owner only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deleted successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440010',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Pocari Sweat 500ml',
        description: 'Refreshing sports drink',
        type: 'BEVERAGE',
        imageUrl: 'https://cdn.example.com/products/pocari.png',
        price: 25000,
        unit: 'VND / bottle',
        stock: 0,
        isActive: false,
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T11:10:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - not center owner.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  @UseGuards(JwtAuthGuard)
  delete(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Req() req: any,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.productService.delete(centerId, ownerId, productId);
  }
}
