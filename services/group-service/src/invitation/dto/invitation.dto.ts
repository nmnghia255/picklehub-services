import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreateEmailInvitationDto {
  @ApiProperty({
    example: 'member@example.com',
    description: 'Email address to invite into the group.',
  })
  @IsEmail()
  email: string;
}
