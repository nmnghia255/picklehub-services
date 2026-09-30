import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateGroupConversationDto {
  @ApiProperty({
    description: 'Group ID from group-service. The caller must be a current group member.',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsUUID()
  groupId: string;
}
