import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({
        example: 'a1b2c3d4e5f6...',
        description:
            'The password reset token received in the email link sent by `/api/auth/forgot-password`.',
    })
    @IsString()
    token: string;

    @ApiProperty({
        example: 'brandNewPassword789',
        description: 'The new password to set. Minimum 8 characters.',
        minLength: 8,
    })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    newPassword: string;
}
