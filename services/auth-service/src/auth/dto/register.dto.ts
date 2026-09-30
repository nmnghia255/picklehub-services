import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({
        example: 'john.doe@example.com',
        description: 'The email address of the new user. Must be unique.',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: 'securePassword123',
        description: 'The password for the new account. Minimum 6 characters.',
        minLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({
        example: 'John Doe',
        description: "The user's full display name.",
    })
    @IsString()
    @IsNotEmpty()
    name: string;
}
