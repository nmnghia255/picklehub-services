import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProductTypeDto } from './create-product.dto';

export class UpdateProductDto {
  @ApiProperty({
    example: 'Pocari Sweat 500ml',
    description: 'Product name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    example: 'Refreshing sports drink',
    description: 'Product description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ProductTypeDto,
    example: ProductTypeDto.BEVERAGE,
    description: 'Type of product',
    required: false,
  })
  @IsEnum(ProductTypeDto)
  @IsOptional()
  type?: ProductTypeDto;

  @ApiProperty({
    example: 25000,
    description: 'Product price in VND',
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @ApiProperty({
    example: 'VND / bottle',
    description: 'Displayed unit for the product price',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  unit?: string;

  @ApiProperty({
    example: 'https://cdn.example.com/products/pocari.png',
    description: 'Optional image URL for the product',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;

  @ApiProperty({
    example: 100,
    description: 'Stock quantity available',
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  stock?: number;

  @ApiProperty({
    example: true,
    description: 'Whether the product is active',
    required: false,
  })
  @IsOptional()
  isActive?: boolean;
}
