import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import { randomBytes, createHash } from 'crypto';
import { OAuthService } from './oauth.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private notificationService: NotificationService,
        private oauthService: OAuthService,
    ) { }

    async register(registerDto: RegisterDto) {
        const { email, password, name } = registerDto;

        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await this.prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                isVerified: false, // User needs to verify email
            },
        });

        // Generate verification token
        const verificationToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await this.prisma.verificationCode.create({
            data: {
                userId: user.id,
                code: verificationToken,
                type: 'EMAIL_VERIFICATION',
                expiresAt,
                used: false,
            },
        });

        // Create verification link that goes to frontend first
        const frontendUrl = this.configService.get<string>('FRONTEND_URL');
        const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

        // Send verification email
        const userName = name || email.split('@')[0];
        await this.notificationService.sendVerificationEmail(email, userName, verificationLink);

        return {
            message: 'Registration successful. Please check your email to verify your account.',
            userId: user.id,
        };
    }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isVerified) {
            throw new ForbiddenException('Account not verified');
        }

        const tokens = await this.getTokens(user.id, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 900,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                isEmailVerified: user.isVerified,
                role: user.role
            }
        };
    }

    async refresh(refreshTokenDto: RefreshTokenDto) {
        const { refreshToken } = refreshTokenDto;

        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });

            const userId = payload.sub;

            const userRefreshTokens = await this.prisma.refreshToken.findMany({
                where: { userId }
            });

            const tokenToHash = createHash('sha256').update(refreshToken).digest('hex');
            let validTokenInDb = null;
            let expiredTokenInDb = null;
            
            for (const tokenRecord of userRefreshTokens) {
                let isMatch = await bcrypt.compare(tokenToHash, tokenRecord.tokenHash).catch(() => false);
                if (!isMatch) {
                    // Legacy fallback for tokens hashed before the fix
                    isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash).catch(() => false);
                }
                
                if (isMatch) {
                    if (tokenRecord.expiresAt < new Date()) {
                        expiredTokenInDb = tokenRecord;
                    } else {
                        validTokenInDb = tokenRecord;
                        break;
                    }
                }
            }

            if (!validTokenInDb && expiredTokenInDb) {
                throw new UnauthorizedException('Refresh token expired');
            } else if (!validTokenInDb) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            const tokens = await this.getTokens(userId, user.role);

            return {
                accessToken: tokens.accessToken,
                expiresIn: 900,
            };

        } catch (e) {
            if (e instanceof UnauthorizedException) {
                throw e;
            }
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async logout(logoutDto: LogoutDto) {
        const { refreshToken } = logoutDto;

        const decoded = this.jwtService.decode(refreshToken) as any;
        if (!decoded || !decoded.sub) {
            return { message: 'Logged out successfully' };
        }
        const userId = decoded.sub;

        const userRefreshTokens = await this.prisma.refreshToken.findMany({
            where: { userId }
        });

        const tokenToHash = createHash('sha256').update(refreshToken).digest('hex');
        for (const tokenRecord of userRefreshTokens) {
            let isMatch = await bcrypt.compare(tokenToHash, tokenRecord.tokenHash).catch(() => false);
            if (!isMatch) {
                isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash).catch(() => false);
            }
            if (isMatch) {
                await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
                break;
            }
        }

        return { message: 'Logged out successfully' };
    }

    async updateRefreshToken(userId: string, refreshToken: string) {
        const tokenToHash = createHash('sha256').update(refreshToken).digest('hex');
        const hash = await bcrypt.hash(tokenToHash, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash: hash,
                expiresAt: new Date(Date.now() + sevenDays),
            }
        });
    }

    async getTokens(userId: string, role: string) {
        const payload = { sub: userId, role };
        const [at, rt] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: process.env.JWT_ACCESS_SECRET,
                expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '15m') as any,
            }),
            this.jwtService.signAsync({ sub: userId }, {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as any,
            }),
        ]);
        return {
            accessToken: at,
            refreshToken: rt,
        };
    }

    /**
     * Verify email using verification token
     * @param token - Verification token from email
     */
    async verifyEmail(token: string) {
        // Find the verification code
        const verificationCode = await this.prisma.verificationCode.findFirst({
            where: {
                code: token,
                type: 'EMAIL_VERIFICATION',
                used: false,
            },
            include: {
                user: true,
            },
        });

        if (!verificationCode) {
            throw new BadRequestException('Invalid or expired verification token');
        }

        // Check if token is expired
        if (verificationCode.expiresAt < new Date()) {
            throw new BadRequestException('Verification token has expired. Please request a new one.');
        }

        // Check if user is already verified
        if (verificationCode.user.isVerified) {
            return {
                message: 'Email already verified. You can now login.',
            };
        }

        // Update user as verified and set status to ACTIVE
        await this.prisma.user.update({
            where: { id: verificationCode.userId },
            data: { isVerified: true, status: 'ACTIVE' },
        });

        // Mark verification code as used
        await this.prisma.verificationCode.update({
            where: { id: verificationCode.id },
            data: { used: true },
        });

        return {
            message: 'Email verified successfully! You can now login to your account.',
        };
    }

    /**
     * Resend verification email
     * @param email - User's email address
     */
    async resendVerificationEmail(email: string) {
        // Find user by email
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // For security, don't reveal if email exists or not
            return {
                message: 'If an account with that email exists and is not verified, a verification email has been sent.',
            };
        }

        // Check if already verified
        if (user.isVerified) {
            return {
                message: 'This email is already verified. You can login to your account.',
            };
        }

        // Invalidate any existing unused verification codes
        await this.prisma.verificationCode.updateMany({
            where: {
                userId: user.id,
                type: 'EMAIL_VERIFICATION',
                used: false,
            },
            data: { used: true },
        });

        // Generate new verification token
        const verificationToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await this.prisma.verificationCode.create({
            data: {
                userId: user.id,
                code: verificationToken,
                type: 'EMAIL_VERIFICATION',
                expiresAt,
                used: false,
            },
        });

        // Create verification link that goes to frontend
        const frontendUrl = this.configService.get<string>('FRONTEND_URL');
        const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

        // Send verification email
        const userName = user.name || email.split('@')[0];
        await this.notificationService.sendVerificationEmail(email, userName, verificationLink);

        return {
            message: 'If an account with that email exists and is not verified, a verification email has been sent.',
        };
    }

    /**
     * Get user profile
     * @param userId - User ID
     */
    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatarUrl: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return user;
    }

    /**
     * Google Login via Token Exchange
     */
    async googleLogin(idToken: string) {
        const payload = await this.oauthService.verifyGoogleToken(idToken);

        // Find existing social account linking
        let socialAccount = await this.prisma.socialAccount.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: 'google',
                    providerAccountId: payload.providerAccountId,
                }
            },
            include: { user: true }
        });

        let user;

        if (socialAccount) {
            user = socialAccount.user;
        } else {
            // Check if user with this email exists but unlinked
            user = await this.prisma.user.findUnique({
                where: { email: payload.email }
            });

            if (!user) {
                // Register new user
                user = await this.prisma.user.create({
                    data: {
                        email: payload.email,
                        name: payload.name ?? null,
                        isVerified: payload.isEmailVerified || true,
                        status: 'ACTIVE',
                        // Leave passwordHash as null since they log in via social
                    }
                });
            }

            // Link the Google account to the new or existing user
            await this.prisma.socialAccount.create({
                data: {
                    userId: user.id,
                    provider: 'google',
                    providerAccountId: payload.providerAccountId,
                }
            });
        }

        if (!user.isActive) {
            throw new ForbiddenException('Account is disabled');
        }

        // If Google authenticated them, and their account wasn't verified or was pending, activate it now.
        if (!user.isVerified || user.status === 'PENDING') {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: { isVerified: true, status: 'ACTIVE' }
            });
        }

        const tokens = await this.getTokens(user.id, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 900,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                isEmailVerified: user.isVerified,
                role: user.role
            }
        };
    }

    /**
     * Link Google Account to currently logged in user
     */
    async linkGoogleAccount(userId: string, idToken: string) {
        const payload = await this.oauthService.verifyGoogleToken(idToken);

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.email !== payload.email) {
            throw new BadRequestException('The email of the Google account does not match your registered email');
        }

        const existingLink = await this.prisma.socialAccount.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: 'google',
                    providerAccountId: payload.providerAccountId,
                }
            }
        });

        if (existingLink) {
            if (existingLink.userId === userId) {
                return { message: 'Google account is already linked' };
            }
            throw new ConflictException('This Google account is already linked to another user');
        }

        await this.prisma.socialAccount.create({
            data: {
                userId,
                provider: 'google',
                providerAccountId: payload.providerAccountId,
            }
        });

        return { message: 'Google account linked successfully' };
    }

    /**
     * Facebook Login via Token Exchange
     */
    async facebookLogin(accessToken: string) {
        const payload = await this.oauthService.verifyFacebookToken(accessToken);

        // Find existing social account linking
        let socialAccount = await this.prisma.socialAccount.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: 'facebook',
                    providerAccountId: payload.providerAccountId,
                }
            },
            include: { user: true }
        });

        let user;

        if (socialAccount) {
            user = socialAccount.user;
        } else {
            // Check if user with this email exists but unlinked
            user = await this.prisma.user.findUnique({
                where: { email: payload.email }
            });

            if (!user) {
                // Register new user
                user = await this.prisma.user.create({
                    data: {
                        email: payload.email,
                        name: payload.name ?? null,
                        isVerified: payload.isEmailVerified || true,
                        status: 'ACTIVE',
                        // Leave passwordHash as null since they log in via social
                    }
                });
            }

            // Link the Facebook account to the new or existing user
            await this.prisma.socialAccount.create({
                data: {
                    userId: user.id,
                    provider: 'facebook',
                    providerAccountId: payload.providerAccountId,
                }
            });
        }

        if (!user.isActive) {
            throw new ForbiddenException('Account is disabled');
        }

        // If Facebook authenticated them, and their account wasn't verified or was pending, activate it now.
        if (!user.isVerified || user.status === 'PENDING') {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: { isVerified: true, status: 'ACTIVE' }
            });
        }

        const tokens = await this.getTokens(user.id, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 900,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                isEmailVerified: user.isVerified,
                role: user.role
            }
        };
    }

    /**
     * Link Facebook Account to currently logged in user
     */
    async linkFacebookAccount(userId: string, accessToken: string) {
        const payload = await this.oauthService.verifyFacebookToken(accessToken);

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.email !== payload.email) {
            throw new BadRequestException('The email of the Facebook account does not match your registered email');
        }

        const existingLink = await this.prisma.socialAccount.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: 'facebook',
                    providerAccountId: payload.providerAccountId,
                }
            }
        });

        if (existingLink) {
            if (existingLink.userId === userId) {
                return { message: 'Facebook account is already linked' };
            }
            throw new ConflictException('This Facebook account is already linked to another user');
        }

        await this.prisma.socialAccount.create({
            data: {
                userId,
                provider: 'facebook',
                providerAccountId: payload.providerAccountId,
            }
        });

        return { message: 'Facebook account linked successfully' };
    }

    /**
     * Set a Password for Social Users
     */
    async setPassword(userId: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.passwordHash) {
            throw new BadRequestException('Password is already set for this account.');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash }
        });

        return { message: 'Password set successfully' };
    }

    /**
     * Get Linked Social Accounts
     */
    async getLinkedAccounts(userId: string) {
        const accounts = await this.prisma.socialAccount.findMany({
            where: { userId },
            select: {
                provider: true,
                createdAt: true,
            }
        });

        return accounts.map((acc: any) => ({
            provider: acc.provider,
            linkedAt: acc.createdAt,
        }));
    }

    /**
     * Unlink a Social Account
     */
    async unlinkSocialAccount(userId: string, provider: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { socialAccounts: true }
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const accountToUnlink = user.socialAccounts.find((acc: any) => acc.provider === provider);

        if (!accountToUnlink) {
            throw new NotFoundException(`No linked ${provider} account found`);
        }

        if (!user.passwordHash && user.socialAccounts.length <= 1) {
            throw new BadRequestException('Cannot unlink your only login method. Please set a password first.');
        }

        await this.prisma.socialAccount.delete({
            where: { id: accountToUnlink.id }
        });

        return { message: `${provider} account unlinked successfully` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Passwordless magic-link login (independent of invitation system)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Step 1 — User provides their email.
     * If an active account exists, a short-lived magic JWT is sent to that email.
     * Always returns a generic message to avoid leaking account existence.
     */
    async requestMagicLogin(email: string): Promise<{ message: string }> {
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (user && user.status === 'ACTIVE') {
            const magicJwt = await this.jwtService.signAsync(
                { sub: user.id, email: user.email, type: 'magic_login' },
                {
                    secret: process.env.JWT_ACCESS_SECRET,
                    expiresIn: '15m',
                },
            );

            const frontendUrl = this.configService.get<string>('FRONTEND_URL');
            const magicUrl = `${frontendUrl}/auth/magic?magic=${magicJwt}`;

            await this.notificationService.sendVerificationEmail(
                user.email,
                user.name ?? user.email.split('@')[0],
                magicUrl,
            );
        }

        return { message: 'If an account with that email exists, a login link has been sent.' };
    }

    /**
     * Step 2 — User clicks the link in their email.
     * Verifies the magic JWT and issues session tokens.
     *
     * If a current session is present:
     *   • Same email  → re-issue tokens (success)
     *   • Different email → 409 identity_mismatch
     */
    async verifyMagicLogin(
        magicJwt: string,
        currentUser?: { id: string; email: string },
    ): Promise<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; name: string | null; role: string };
    }> {
        let payload: { sub: string; email: string; type: string };
        try {
            payload = await this.jwtService.verifyAsync(magicJwt, {
                secret: process.env.JWT_ACCESS_SECRET,
            });
        } catch {
            throw new UnauthorizedException('Magic link is invalid or has expired.');
        }

        if (payload.type !== 'magic_login') {
            throw new UnauthorizedException('Magic link is invalid or has expired.');
        }

        // Identity mismatch — already logged in as a different account
        if (currentUser && currentUser.email !== payload.email) {
            throw new ConflictException({
                status: 'identity_mismatch',
                loginHint: payload.email,
                message: 'You are currently logged in as a different account. Please log out first.',
            });
        }

        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user || user.status !== 'ACTIVE') {
            throw new NotFoundException('Account not found or inactive.');
        }

        const tokens = await this.getTokens(user.id, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        };
    }
}
