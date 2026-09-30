import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class QueryPlayerBookingsDto {
  @ApiProperty({ description: 'ID of the player' })
  @IsString()
  @IsNotEmpty()
  playerId: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  endDate?: string;
}
