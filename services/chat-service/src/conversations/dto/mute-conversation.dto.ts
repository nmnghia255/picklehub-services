import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class MuteConversationDto {
  @ApiPropertyOptional({
    description: 'ISO timestamp until the conversation should remain muted. Send null to unmute.',
    nullable: true,
    example: '2026-07-03T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  mutedUntil?: string | null;
}
