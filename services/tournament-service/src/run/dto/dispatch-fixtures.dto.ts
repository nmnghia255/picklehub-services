import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class DispatchFixturesDto {
  @ApiPropertyOptional({
    description: 'Limit the dispatch to a single event. Omit to dispatch every ready fixture in the tournament.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  eventId?: number;
}
