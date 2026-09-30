import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum CourtTypeDto {
  INDOOR = 'INDOOR',
  OUTDOOR = 'OUTDOOR',
}

export enum CourtStatusDto {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  ARCHIVED = 'ARCHIVED',
}

export class CreateCourtDto {
  @ApiProperty({
    example: 'San 1',
    description: 'Court display name inside the sport center',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    enum: CourtTypeDto,
    example: CourtTypeDto.INDOOR,
    description: 'Physical court type',
  })
  @IsEnum(CourtTypeDto)
  type!: CourtTypeDto;

  @ApiProperty({
    enum: CourtStatusDto,
    required: false,
    example: CourtStatusDto.ACTIVE,
    description: 'Lifecycle status of the court',
  })
  @IsOptional()
  @IsEnum(CourtStatusDto)
  status?: CourtStatusDto;
}
