import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WinnerTeam } from '@prisma/client';

export class ConfirmResultDto {
  @ApiPropertyOptional({
    example: 'TEAM_A',
    enum: WinnerTeam,
    description:
      'Declare the match winner when confirming the result. This is required when the referee confirms the match and optional when a player confirms, because the service can derive the winner from the submitted score if omitted.',
  })
  @IsOptional()
  @IsEnum(WinnerTeam)
  winner?: WinnerTeam;

  @ApiPropertyOptional({ example: 11, description: 'Final score for Team A' })
  @IsOptional()
  scoreA?: number;

  @ApiPropertyOptional({ example: 8, description: 'Final score for Team B' })
  @IsOptional()
  scoreB?: number;

  @ApiPropertyOptional({ example: [[11, 5], [9, 11], [11, 8]], description: 'Set-by-set scores' })
  @IsOptional()
  sets?: any[];
}
