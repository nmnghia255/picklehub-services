import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
    @ApiProperty({
        example: 'john.doe@example.com',
        description:
            'The email address of the account you want to reset the password for. ' +
            'A password reset link will be sent to this address if an account exists.',
    })
    @IsEmail({}, { message: 'Invalid email address' })
    email: string;
}
