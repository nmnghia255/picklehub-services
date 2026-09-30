import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({
        example: 'oldSecurePassword123',
        description: 'The current password for the account. Minimum 8 characters.',
        minLength: 8,
    })
    @IsString()
    @MinLength(8, { message: 'Old password must be at least 8 characters' })
    oldPassword: string;

    @ApiProperty({
        example: 'newEvenMoreSecure456',
        description: 'The new password to set for the account. Minimum 8 characters.',
        minLength: 8,
    })
    @IsString()
    @MinLength(8, { message: 'New password must be at least 8 characters' })
    newPassword: string;
}
