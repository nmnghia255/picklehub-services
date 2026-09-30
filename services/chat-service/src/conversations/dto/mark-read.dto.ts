import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MarkReadDto {
  @ApiProperty({
    description: 'Message ID to store as the caller read cursor.',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsUUID()
  messageId: string;
}
