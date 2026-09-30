import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateDirectConversationDto {
  @ApiProperty({
    description: 'Target friend user ID. The caller must already be friends with this user.',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsUUID()
  userId: string;
}
