import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma.service';
import axios from 'axios';

@Injectable()
export class OAuthService {
    private googleClient: OAuth2Client;
    private facebookAppId: string | undefined;
    private facebookAppSecret: string | undefined;

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        // We initialize the client without a fixed client ID here, 
        // and specify allowed audiences during token verification instead.
        this.googleClient = new OAuth2Client();

        this.facebookAppId = this.configService.get<string>('FACEBOOK_APP_ID');
        this.facebookAppSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    }

    async verifyGoogleToken(idToken: string) {
        try {
            // Support multiple client IDs (Web, Android, iOS) for cross-platform integration
            const audiences = [
                this.configService.get<string>('GOOGLE_CLIENT_ID'),
                this.configService.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
                this.configService.get<string>('GOOGLE_IOS_CLIENT_ID'),
            ].filter((id): id is string => !!id);

            if (!audiences.length) {
                throw new UnauthorizedException('Google login is not configured');
            }
            

            const ticket = await this.googleClient.verifyIdToken({
                idToken,
                audience: audiences,
            });
            const payload = ticket.getPayload();
            if (!payload) {
                throw new UnauthorizedException('Invalid Google token');
            }
            if (!payload.email) {
                throw new UnauthorizedException('Google token does not contain an email');
            }

            if (payload.aud && !audiences.includes(payload.aud)) {
                throw new UnauthorizedException('Google token audience mismatch');
            }

            return {
                providerAccountId: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                isEmailVerified: payload.email_verified,
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('Failed to verify Google token');
        }
    }

    async verifyFacebookToken(accessToken: string) {
        if (!this.facebookAppId || !this.facebookAppSecret) {
            throw new UnauthorizedException('Facebook login is not configured');
        }

        try {
            // Step 1: Validate the token was issued for our app
            const debugResponse = await axios.get(
                `https://graph.facebook.com/debug_token`, {
                    params: {
                        input_token: accessToken,
                        access_token: `${this.facebookAppId}|${this.facebookAppSecret}`,
                    },
                },
            );

            const debugData = debugResponse.data?.data;
            if (!debugData || !debugData.is_valid) {
                throw new UnauthorizedException('Invalid Facebook token');
            }
            if (String(debugData.app_id) !== String(this.facebookAppId)) {
                throw new UnauthorizedException('Invalid Facebook token');
            }

            // Step 2: Fetch user profile
            const profileResponse = await axios.get(
                `https://graph.facebook.com/me`, {
                    params: {
                        fields: 'id,name,email,picture',
                        access_token: accessToken,
                    },
                },
            );

            const profile = profileResponse.data;
            if (!profile.email) {
                throw new UnauthorizedException('Facebook token does not contain an email');
            }

            return {
                providerAccountId: profile.id,
                email: profile.email,
                name: profile.name,
                picture: profile.picture?.data?.url,
                isEmailVerified: true,
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('Failed to verify Facebook token');
        }
    }
}
