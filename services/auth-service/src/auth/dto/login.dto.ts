import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        example: 'john.doe@example.com',
        description: "The user's registered email address.",
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: 'securePassword123',
        description: "The user's account password.",
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}
