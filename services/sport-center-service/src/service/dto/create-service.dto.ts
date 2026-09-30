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

export enum ServiceTypeDto {
  EQUIPMENT_RENTAL = 'EQUIPMENT_RENTAL',
  COACHING = 'COACHING',
  FACILITY_ADD_ON = 'FACILITY_ADD_ON',
}

export class CreateServiceDto {
  @ApiProperty({
    example: 'Racket Rental',
    description: 'Service name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

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
  })
  @IsEnum(ServiceTypeDto)
  @IsNotEmpty()
  type!: ServiceTypeDto;

  @ApiProperty({
    example: 25000,
    description: 'Service price in VND',
  })
  @IsNumber()
  @IsPositive()
  price!: number;

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
}
