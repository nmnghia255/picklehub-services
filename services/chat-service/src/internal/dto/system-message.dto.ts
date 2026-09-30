import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SystemMessageDto {
  @ApiProperty({
    description: 'System message text shown in the conversation timeline.',
    example: 'A new member joined the group.',
    maxLength: 4000,
  })
  @IsString()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata for frontend rendering.',
    example: { eventType: 'GROUP_MEMBER_JOINED' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
