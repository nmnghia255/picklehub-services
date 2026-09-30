import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddLiveGuestDto {
  @ApiProperty({
    example: 'Walk-up Friend',
    maxLength: 120,
    description:
      'Display name for the walk-up guest. Required since guests have no user account to derive a name from.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  guestName!: string;

  @ApiPropertyOptional({
    example: 3.0,
    minimum: 0,
    maximum: 6,
    description:
      'Optional skill rating used by the matchmaker when dispatching the guest into a match.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(6)
  skillLevel?: number;
}
