import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
    @ApiProperty({
        example: 'StrongPassword123!',
        description: 'The new password to set for the account. Must be at least 6 characters long.',
        minLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
