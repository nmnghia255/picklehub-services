import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateSocialConversationDto {
  @ApiProperty({
    description: 'Social ID from event-service. The caller must be the social host or a confirmed participant.',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsUUID()
  socialId: string;
}
