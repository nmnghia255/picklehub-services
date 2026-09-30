import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferOwnershipDto {
  @ApiProperty({
    example: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
    description: 'Target member user id (UUID) to transfer group ownership to.',
  })
  @IsUUID('4', { message: 'targetMemberId must be a valid UUID v4' })
  targetMemberId: string;
}
