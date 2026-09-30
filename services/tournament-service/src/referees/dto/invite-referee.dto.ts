import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteRefereeDto {
  @ApiProperty({
    description: 'Email address of the referee to invite',
    example: 'referee@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
