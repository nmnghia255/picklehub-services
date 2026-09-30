import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsArray, IsInt } from 'class-validator';

export class DrawGroupsDto {
  // Empty for now as drawing is random shuffle only, but we could support force re-draw
  @ApiPropertyOptional({ description: 'Force re-draw if groups already exist', example: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    description: 'Array of team IDs to be treated as priority/wildcard teams (placed in Pot 1)',
    example: [12, 45, 78],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  priorityTeamIds?: number[];
}
