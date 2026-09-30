import { IsInt, IsOptional, IsString, Max, MaxLength, MinLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGroupDto {
  @ApiPropertyOptional({
    example: 'Sunrise Pickleball Club',
    minLength: 1,
    maxLength: 100,
    description: 'New group name.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated group description',
    description: 'New group description.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.picklehub.app/groups/sunrise-v2.png',
    maxLength: 500,
    description: 'New avatar URL.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: 50,
    minimum: 1,
    maximum: 50,
    description: 'Maximum allowed members.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxMembers?: number;
}
