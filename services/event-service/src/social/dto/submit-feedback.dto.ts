import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class SubmitSocialFeedbackDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: 'Overall experience rating (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  ratingOverall!: number;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5, description: 'Match coordination, friendliness and organization rating (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  ratingOrganization!: number;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5, description: 'Venue quality, court conditions and facilities rating (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  ratingVenue!: number;

  @ApiPropertyOptional({ example: 'Great courts and organization!', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
