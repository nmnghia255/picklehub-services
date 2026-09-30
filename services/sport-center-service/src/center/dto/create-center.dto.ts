import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export enum SportCenterStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateCenterDto {
  @ApiProperty({
    example: 'PickleHub District 1',
    description: 'Sport center display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    example: '123 Nguyen Hue, District 1, Ho Chi Minh City',
    description: 'Sport center full address',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @ApiProperty({
    example: '+84901234567',
    description: 'Contact phone number',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{9,15}$/)
  phone!: string;

  @ApiProperty({
    example: 'hello@pickledome.com',
    description: 'Contact email address',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    example: 'Pickle Dome Sukhumvit is a modern pickleball venue...',
    description: 'Detailed description of the center',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    type: [String],
    example: ['https://example.com/image1.jpg'],
    description: 'List of image URLs for gallery and headers',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({
    type: [String],
    example: ['Please arrive 10 mins early', 'Non-marking shoes only'],
    description: 'List of rules and regulations',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rules?: string[];

  @ApiProperty({
    example: '06:00',
    description: 'Opening time in HH:mm format',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  openTime!: string;

  @ApiProperty({
    example: '22:00',
    description: 'Closing time in HH:mm format',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  closeTime!: string;

  @ApiProperty({
    example: 80000,
    description:
      'Base price per hour (VND). Applied to any time window not covered by a specific price slot.',
  })
  @IsNumber()
  @IsPositive()
  basePrice!: number;

  @ApiProperty({
    enum: SportCenterStatusDto,
    required: false,
    example: SportCenterStatusDto.ACTIVE,
    description: 'Lifecycle status of the sport center',
  })
  @IsOptional()
  @IsEnum(SportCenterStatusDto)
  status?: SportCenterStatusDto;

  @ApiProperty({
    type: [String],
    required: false,
    example: ['Parking', 'Shower', 'Cafe'],
    description: 'Amenities available at the sport center',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  amenities?: string[];

  // ─── Payment info (required at creation) ─────────────────────────────────

  @ApiProperty({
    example: 'NGUYEN VAN AN',
    description: 'Bank account holder name shown to players after booking',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  paymentAccountName!: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Bank account number for payment transfers',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  paymentAccountNumber!: string;

  @ApiProperty({
    example: 'VietcomBank',
    description: 'Name of the receiving bank (e.g. Techcombank, VietcomBank)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  paymentBankName!: string;

  @ApiProperty({
    example: 'https://cdn.example.com/qr/sample-qr.png',
    description: 'URL of the QR code image for in-app payment scanning (optional)',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  paymentQrUrl?: string;
}
