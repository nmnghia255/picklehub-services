import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
    @ApiProperty({
        example: 'a1b2c3d4e5f6...',
        description:
            'The 64-character hex verification token sent to the user\'s email address during registration or after calling `/api/auth/resend-verification`.',
    })
    @IsString()
    token: string;
}
