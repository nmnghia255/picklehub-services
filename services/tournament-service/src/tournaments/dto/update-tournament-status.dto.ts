import { IsEnum } from 'class-validator';
import { TournamentStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTournamentStatusDto {
  @ApiProperty({
    description: 'The new status for the tournament',
    enum: TournamentStatus,
    example: 'published'
  })
  @IsEnum(TournamentStatus)
  status: TournamentStatus;
}