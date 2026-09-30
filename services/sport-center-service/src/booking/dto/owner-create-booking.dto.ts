import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BookingProductItemDto, BookingServiceItemDto } from './booking-line-item.dto';
import { BookingRequestItemDto } from './booking-request-item.dto';

export class OwnerCreateBookingDto {
  @ApiProperty({
    example: '2026-05-15',
    description: 'Booking date in YYYY-MM-DD format',
  })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({
    type: BookingRequestItemDto,
    isArray: true,
    description:
      'List of courts/time ranges to book in this center on the same date. Each item must be at least 30 minutes and align to 30-minute boundaries (e.g. 17:00, 17:30, 18:00).',
    example: [
      {
        courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
        startTime: '17:30',
        endTime: '19:00',
      },
      {
        courtId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        startTime: '19:00',
        endTime: '21:00',
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BookingRequestItemDto)
  items!: BookingRequestItemDto[];

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of the player booking directly at the center',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  playerName!: string;

  @ApiProperty({
    example: '+66 81 234 5678',
    description: 'Phone number provided by the owner for this booking',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber!: string;

  @ApiProperty({
    type: BookingServiceItemDto,
    isArray: true,
    example: [
      { serviceId: '550e8400-e29b-41d4-a716-446655440001', quantity: 1 },
    ],
    description: 'Preferred service line items to include in booking',
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingServiceItemDto)
  @IsOptional()
  serviceItems?: BookingServiceItemDto[];

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
    description: 'Legacy list of service IDs to include in booking',
    required: false,
    deprecated: true,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  serviceIds?: string[];

  @ApiProperty({
    type: BookingProductItemDto,
    isArray: true,
    example: [
      { productId: '550e8400-e29b-41d4-a716-446655440010', quantity: 2 },
    ],
    description: 'Preferred product line items to include in booking',
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingProductItemDto)
  @IsOptional()
  productItems?: BookingProductItemDto[];

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011'],
    description: 'Legacy list of product IDs to include in booking',
    required: false,
    deprecated: true,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];

  @ApiProperty({
    example: 'Walk-in customer',
    description: 'Optional note from the owner',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}
