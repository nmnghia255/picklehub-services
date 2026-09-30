import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({
    example: 'Sunrise Pickleball Club',
    minLength: 1,
    maxLength: 100,
    description: 'Group display name.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'Friendly neighborhood morning group',
    description: 'Optional group description.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.picklehub.app/groups/sunrise.png',
    maxLength: 500,
    description: 'Optional avatar URL.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
