import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateSessionDto {
  @ApiPropertyOptional({
    example: 'Morning Session',
    description: 'Title of the play session.',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: ['bookingId1', 'bookingId2'],
    description: 'Updated list of court booking IDs for this session.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  bookingIds?: string[];


  @ApiPropertyOptional({
    example: 500000,
    description: 'Price of the play session (custom fee defined by host).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sessionFee?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSlots?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum number of slots/participants for this session.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSlot?: number;
}
