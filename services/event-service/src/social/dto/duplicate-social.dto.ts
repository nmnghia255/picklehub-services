import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsString,
  ValidateNested,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DuplicatePlaySessionDto {
  @ApiProperty({
    example: 'Morning Session',
    description: 'Title of the play session.',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    example: ['bookingId1', 'bookingId2'],
    description: 'List of court booking IDs linked to this session.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  bookingIds!: string[];

  @ApiProperty({
    example: '2026-03-30T09:00:00.000Z',
    description: 'Session start time',
  })
  @IsDateString()
  startTime!: string;

  @ApiProperty({
    example: '2026-03-30T11:00:00.000Z',
    description: 'Session end time',
  })
  @IsDateString()
  endTime!: string;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Price of the play session (custom fee defined by host).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sessionFee?: number;
}

export class DuplicateSocialDto {
  @ApiProperty({
    type: [DuplicatePlaySessionDto],
    description: 'Play sessions to be created for the duplicated social.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DuplicatePlaySessionDto)
  newSessions!: DuplicatePlaySessionDto[];
}
