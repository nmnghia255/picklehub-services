import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfigureGroupStageDto {
  @ApiPropertyOptional({ description: 'Number of groups to create', example: 4 })
  @IsOptional()
  @IsInt()
  @Min(2)
  numGroups?: number;

  @ApiPropertyOptional({ description: 'Advancement method: standard (top base teams per group) or best_of_rest (top base + lucky losers)', example: 'standard' })
  @IsOptional()
  @IsString()
  advanceMethod?: string;

  @ApiPropertyOptional({ description: 'Total number of teams to advance to the knockout stage', example: 8 })
  @IsOptional()
  @IsInt()
  @Min(2)
  totalAdvance?: number;
}
