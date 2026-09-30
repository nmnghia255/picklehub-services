import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class BookingServiceItemDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Service ID to include in booking',
  })
  @IsUUID('4')
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({
    example: 1,
    description: 'Quantity of this service to book',
    required: false,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;
}

export class BookingProductItemDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440010',
    description: 'Product ID to include in booking',
  })
  @IsUUID('4')
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity of this product to book',
    required: false,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;
}

export type BookingSelection = {
  id: string;
  quantity: number;
};
