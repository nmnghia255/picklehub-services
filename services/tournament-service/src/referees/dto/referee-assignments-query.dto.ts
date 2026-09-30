import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RefereeAssignmentsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by tournament event ID', example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  eventId?: number;
}
