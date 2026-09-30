import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
    @ApiProperty({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description:
            'A valid refresh token previously issued by `/api/auth/login` or `/api/auth/google`. ' +
            'Refresh tokens are valid for 7 days.',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
