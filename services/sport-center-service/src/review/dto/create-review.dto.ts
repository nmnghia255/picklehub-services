import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ example: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', description: 'Sport center ID' })
  @IsUUID()
  @IsNotEmpty()
  centerId: string;

  @ApiProperty({ example: 5, description: 'Rating from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Great place!', description: 'Review comment' })
  @IsString()
  @IsOptional()
  comment?: string;
}
