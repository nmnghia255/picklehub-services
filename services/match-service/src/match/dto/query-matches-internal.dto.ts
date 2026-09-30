import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class QueryMatchesInternalDto {
  @ApiProperty({ description: 'User UUID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ description: 'Start date (ISO datetime)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO datetime)' })
  @IsString()
  @IsOptional()
  endDate?: string;
}
