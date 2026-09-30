import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
    @ApiProperty({
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
        description:
            'The Google ID token obtained from the Google Sign-In flow on the client side. ' +
            'This token is verified server-side against Google\'s public keys.',
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;
}

export class LinkGoogleAccountDto {
    @ApiProperty({
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
        description:
            'The Google ID token for the Google account you wish to link to your existing PickleHub account. ' +
            'The email in this token must match your registered account email.',
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;
}

export class FacebookLoginDto {
    @ApiProperty({
        example: 'EAABsbCS1iZAIBO...',
        description:
            'The Facebook access token obtained from the Facebook Login flow on the client side. ' +
            'This token is verified server-side against Facebook\'s Graph API.',
    })
    @IsString()
    @IsNotEmpty()
    accessToken: string;
}

export class LinkFacebookAccountDto {
    @ApiProperty({
        example: 'EAABsbCS1iZAIBO...',
        description:
            'The Facebook access token for the Facebook account you wish to link to your existing PickleHub account. ' +
            'The email in this token must match your registered account email.',
    })
    @IsString()
    @IsNotEmpty()
    accessToken: string;
}
