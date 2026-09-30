import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
    @ApiProperty({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description:
            'The refresh token to invalidate. After a successful logout, this token can no longer be used.',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
