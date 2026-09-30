import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty({ description: 'The UUID of the user to send a friend request to', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  receiverId: string;
}
