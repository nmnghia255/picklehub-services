import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AwardPrizeDto {
  @ApiPropertyOptional({
    description: 'The unique ID of the winning team, or null to remove the award',
    example: 200,
    nullable: true,
  })
  @IsNumber()
  @IsOptional()
  winnerTeamId?: number | null;
}
