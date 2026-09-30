import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
    @ApiProperty({
        example: 'john.doe@example.com',
        description: "The email address of the account to resend the verification email to.",
    })
    @IsEmail({}, { message: 'Invalid email address' })
    email: string;
}
