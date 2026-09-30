import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ServiceTypeDto } from './create-service.dto';

export class UpdateServiceDto {
  @ApiProperty({
    example: 'Racket Rental',
    description: 'Service name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    example: 'Rent a professional pickleball racket',
    description: 'Service description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: ServiceTypeDto,
    example: ServiceTypeDto.EQUIPMENT_RENTAL,
    description: 'Type of service',
    required: false,
  })
  @IsEnum(ServiceTypeDto)
  @IsOptional()
  type?: ServiceTypeDto;

  @ApiProperty({
    example: 25000,
    description: 'Service price in VND',
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @ApiProperty({
    example: 'VND / 3h',
    description: 'Displayed unit for the service price',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  unit?: string;

  @ApiProperty({
    example: 'https://cdn.example.com/services/racket-rental.png',
    description: 'Optional image URL for the service',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;

  @ApiProperty({
    example: true,
    description: 'Whether the service is active',
    required: false,
  })
  @IsOptional()
  isActive?: boolean;
}
