import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class QuerySocialsInternalDto {
  @ApiProperty({ description: 'User UUID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ description: 'Start date (ISO datetime or YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO datetime or YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  endDate?: string;
}
