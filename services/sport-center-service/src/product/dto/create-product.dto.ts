import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export enum ProductTypeDto {
  BEVERAGE = 'BEVERAGE',
  CONSUMABLE = 'CONSUMABLE',
  EQUIPMENT = 'EQUIPMENT',
  CLOTHING = 'CLOTHING',
}

export class CreateProductDto {
  @ApiProperty({
    example: 'Pocari Sweat 500ml',
    description: 'Product name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

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
  })
  @IsEnum(ProductTypeDto)
  @IsNotEmpty()
  type!: ProductTypeDto;

  @ApiProperty({
    example: 25000,
    description: 'Product price in VND',
  })
  @IsNumber()
  @IsPositive()
  price!: number;

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
}
