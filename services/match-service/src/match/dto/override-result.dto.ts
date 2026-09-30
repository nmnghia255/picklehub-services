import { IsEnum, IsOptional, IsInt, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WinnerTeam } from '@prisma/client';

export class OverrideResultDto {
  @ApiPropertyOptional({
    example: 'TEAM_A',
    enum: WinnerTeam,
    description: 'Manual winner override.',
  })
  @IsOptional()
  @IsEnum(WinnerTeam)
  winner?: WinnerTeam;

  @ApiPropertyOptional({ example: 11, description: 'Overridden final score for Team A' })
  @IsOptional()
  @IsInt()
  scoreA?: number;

  @ApiPropertyOptional({ example: 8, description: 'Overridden final score for Team B' })
  @IsOptional()
  @IsInt()
  scoreB?: number;

  @ApiPropertyOptional({ example: [[11, 5], [9, 11], [11, 8]], description: 'Set-by-set scores override' })
  @IsOptional()
  @IsArray()
  sets?: any[];
}
