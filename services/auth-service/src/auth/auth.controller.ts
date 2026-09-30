import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Delete, Param } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { GoogleLoginDto, LinkGoogleAccountDto, FacebookLoginDto, LinkFacebookAccountDto } from './dto/social-auth.dto';
import { RequestMagicLoginDto } from './dto/request-magic-login.dto';
import { VerifyMagicLoginDto } from './dto/verify-magic-login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

@ApiTags('Authentication')
@Controller()
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    // ─── Register ────────────────────────────────────────────────────────────

    @Post('register')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Register a new user',
        description:
            'Creates a new user account. A verification email is sent to the provided address. ' +
            'The user **must verify their email** before they can log in.',
    })
    @ApiBody({ type: RegisterDto })
    @ApiResponse({
        status: 200,
        description: 'Registration successful. Verification email sent.',
        schema: {
            example: {
                message: 'Registration successful. Please check your email to verify your account.',
                userId: 'clxyz1234abcd',
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Validation error – missing or invalid fields.' })
    @ApiResponse({ status: 409, description: 'Conflict – an account with this email already exists.' })
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    // ─── Login ───────────────────────────────────────────────────────────────

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Log in with email & password',
        description:
            'Authenticates a user and returns JWT access and refresh tokens.\n\n' +
            '- The **access token** is valid for **15 minutes**.\n' +
            '- The **refresh token** is valid for **7 days**.\n\n' +
            'The user\'s email must be verified before login is allowed.',
    })
    @ApiBody({ type: LoginDto })
    @ApiResponse({
        status: 200,
        description: 'Login successful. Returns access token, refresh token, and user profile.',
        schema: {
            example: {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                expiresIn: 900,
                user: {
                    id: 'clxyz1234abcd',
                    email: 'john.doe@example.com',
                    name: 'John Doe',
                    isEmailVerified: true,
                    role: 'USER',
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Validation error – missing or invalid fields.' })
    @ApiResponse({ status: 401, description: 'Unauthorized – invalid email or password.' })
    @ApiResponse({ status: 403, description: 'Forbidden – email not verified.' })
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    // ─── Refresh Token ───────────────────────────────────────────────────────

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Refresh access token',
        description:
            'Issues a new **access token** using a valid refresh token. ' +
            'The original refresh token remains valid until it expires or is explicitly revoked via `/logout`.',
    })
    @ApiBody({ type: RefreshTokenDto })
    @ApiResponse({
        status: 200,
        description: 'New access token issued.',
        schema: {
            example: {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                expiresIn: 900,
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized – refresh token is invalid or expired.' })
    refresh(@Body() refreshTokenDto: RefreshTokenDto) {
        return this.authService.refresh(refreshTokenDto);
    }

    // ─── Logout ──────────────────────────────────────────────────────────────

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Log out (invalidate refresh token)',
        description:
            'Revokes the provided refresh token from the server. ' +
            'Subsequent calls to `/refresh` with that token will fail. ' +
            'The client should also discard the access token.',
    })
    @ApiBody({ type: LogoutDto })
    @ApiResponse({
        status: 200,
        description: 'Logged out successfully.',
        schema: { example: { message: 'Logged out successfully' } },
    })
    logout(@Body() logoutDto: LogoutDto) {
        return this.authService.logout(logoutDto);
    }

    // ─── Verify Email ────────────────────────────────────────────────────────

    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Verify email address',
        description:
            'Verifies the user\'s email using the token sent during registration (or via `/resend-verification`). ' +
            'Tokens expire after **24 hours**.',
    })
    @ApiBody({ type: VerifyEmailDto })
    @ApiResponse({
        status: 200,
        description: 'Email verified successfully.',
        schema: {
            example: { message: 'Email verified successfully! You can now login to your account.' },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – token is invalid or expired.' })
    verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
        return this.authService.verifyEmail(verifyEmailDto.token);
    }

    // ─── Resend Verification ─────────────────────────────────────────────────

    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Resend email verification link',
        description:
            'Sends a new verification email to the given address. ' +
            'Any previously unused verification tokens are invalidated.\n\n' +
            '> **Security note:** Always returns a success message regardless of whether the email exists, to prevent user enumeration.',
    })
    @ApiBody({ type: ResendVerificationDto })
    @ApiResponse({
        status: 200,
        description: 'Verification email sent (or silently skipped if account not found / already verified).',
        schema: {
            example: {
                message:
                    'If an account with that email exists and is not verified, a verification email has been sent.',
            },
        },
    })
    resendVerification(@Body() resendVerificationDto: ResendVerificationDto) {
        return this.authService.resendVerificationEmail(resendVerificationDto.email);
    }

    // ─── Google Login ─────────────────────────────────────────────────────────

    @Post('google')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Sign in / register with Google',
        description:
            'Authenticates (or registers) a user via a **Google ID token** (Direct Token Exchange).\n\n' +
            '**Flow:**\n' +
            '1. Client completes Google Sign-In and obtains an `idToken`.\n' +
            '2. Client sends the token to this endpoint.\n' +
            '3. Server verifies the token with Google, finds or creates the user, and returns JWT tokens.\n\n' +
            'If an account with the same email already exists but was created via email/password, a new `SocialAccount` link is automatically created.',
    })
    @ApiBody({ type: GoogleLoginDto })
    @ApiResponse({
        status: 200,
        description: 'Authentication successful. Returns access token, refresh token, and user profile.',
        schema: {
            example: {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                expiresIn: 900,
                user: {
                    id: 'clxyz1234abcd',
                    email: 'john.doe@example.com',
                    name: 'John Doe',
                    isEmailVerified: true,
                    role: 'USER',
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – Google ID token is missing or malformed.' })
    @ApiResponse({ status: 401, description: 'Unauthorized – Google ID token is invalid or expired.' })
    @ApiResponse({ status: 403, description: 'Forbidden – account is disabled.' })
    googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
        return this.authService.googleLogin(googleLoginDto.idToken);
    }

    // ─── Link Google Account ──────────────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Post('google/link')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Link a Google account to an existing account',
        description:
            'Links a Google account to the currently authenticated user so they can sign in via Google in the future.\n\n' +
            '**Requirements:**\n' +
            '- The request must include a valid **Bearer access token** in the `Authorization` header.\n' +
            '- The email in the Google ID token must match the email of the authenticated user.',
    })
    @ApiBody({ type: LinkGoogleAccountDto })
    @ApiResponse({
        status: 200,
        description: 'Google account linked (or was already linked).',
        schema: {
            example: { message: 'Google account linked successfully' },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – Google email does not match account email.' })
    @ApiResponse({ status: 401, description: 'Unauthorized – access token missing or invalid.' })
    @ApiResponse({ status: 409, description: 'Conflict – Google account is already linked to a different user.' })
    linkGoogleAccount(@Request() req: any, @Body() linkGoogleAccountDto: LinkGoogleAccountDto) {
        return this.authService.linkGoogleAccount(req.user.sub, linkGoogleAccountDto.idToken);
    }

    // ─── Facebook Login ─────────────────────────────────────────────────────────

    @Post('facebook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Sign in / register with Facebook',
        description:
            'Authenticates (or registers) a user via a **Facebook access token** (Direct Token Exchange).\n\n' +
            '**Flow:**\n' +
            '1. Client completes Facebook Login and obtains an `accessToken`.\n' +
            '2. Client sends the token to this endpoint.\n' +
            '3. Server verifies the token with Facebook, finds or creates the user, and returns JWT tokens.\n\n' +
            'If an account with the same email already exists but was created via email/password, a new `SocialAccount` link is automatically created.',
    })
    @ApiBody({ type: FacebookLoginDto })
    @ApiResponse({
        status: 200,
        description: 'Authentication successful. Returns access token, refresh token, and user profile.',
        schema: {
            example: {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                expiresIn: 900,
                user: {
                    id: 'clxyz1234abcd',
                    email: 'john.doe@example.com',
                    name: 'John Doe',
                    isEmailVerified: true,
                    role: 'USER',
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request - Facebook access token is missing or malformed.' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Facebook access token is invalid or expired.' })
    @ApiResponse({ status: 403, description: 'Forbidden - account is disabled.' })
    facebookLogin(@Body() facebookLoginDto: FacebookLoginDto) {
        return this.authService.facebookLogin(facebookLoginDto.accessToken);
    }

    // ─── Link Facebook Account ──────────────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Post('facebook/link')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Link a Facebook account to an existing account',
        description:
            'Links a Facebook account to the currently authenticated user so they can sign in via Facebook in the future.\n\n' +
            '**Requirements:**\n' +
            '- The request must include a valid **Bearer access token** in the `Authorization` header.\n' +
            '- The email in the Facebook account must match the email of the authenticated user.',
    })
    @ApiBody({ type: LinkFacebookAccountDto })
    @ApiResponse({
        status: 200,
        description: 'Facebook account linked (or was already linked).',
        schema: {
            example: { message: 'Facebook account linked successfully' },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request - Facebook email does not match account email.' })
    @ApiResponse({ status: 401, description: 'Unauthorized - access token missing or invalid.' })
    @ApiResponse({ status: 409, description: 'Conflict - Facebook account is already linked to a different user.' })
    linkFacebookAccount(@Request() req: any, @Body() linkFacebookAccountDto: LinkFacebookAccountDto) {
        return this.authService.linkFacebookAccount(req.user.sub, linkFacebookAccountDto.accessToken);
    }

    // ─── Set Password ─────────────────────────────────────────────────────────

    @ApiTags('Password Management')
    @UseGuards(JwtAuthGuard)
    @Post('set-password')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Set password for the current user',
        description: 'Sets a password for an account that does not have one (e.g., registered via social login). Required before unlinking the only social account.',
    })
    @ApiBody({ type: SetPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Password set successfully.',
        schema: {
            example: { message: 'Password set successfully' },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – User already has a password set.' })
    @ApiResponse({ status: 401, description: 'Unauthorized – access token missing or invalid.' })
    setPassword(@Request() req: any, @Body() setPasswordDto: SetPasswordDto) {
        return this.authService.setPassword(req.user.sub, setPasswordDto.password);
    }

    // ─── Get Linked Social Accounts ──────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('social/linked')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get all linked social accounts',
        description: 'Returns a list of social accounts linked to the currently authenticated user.',
    })
    @ApiResponse({
        status: 200,
        description: 'List of linked accounts.',
        schema: {
            example: [
                { provider: 'google', linkedAt: '2023-10-01T12:00:00.000Z' }
            ],
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized – access token missing or invalid.' })
    getLinkedAccounts(@Request() req: any) {
        return this.authService.getLinkedAccounts(req.user.sub);
    }

    // ─── Unlink Social Account ───────────────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Delete('social/:provider')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Unlink a social account',
        description:
            'Unlinks the specified social provider (e.g., "google") from the user\'s account.\n\n' +
            'Cannot unlink if it is the only login method (i.e. if no password is set and it is the single social account).',
    })
    @ApiResponse({
        status: 200,
        description: 'Account unlinked successfully.',
        schema: {
            example: { message: 'google account unlinked successfully' },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – Cannot unlink only login method.' })
    @ApiResponse({ status: 401, description: 'Unauthorized – access token missing or invalid.' })
    @ApiResponse({ status: 404, description: 'Not Found – No linked account found.' })
    unlinkSocialAccount(@Request() req: any, @Param('provider') provider: string) {
        return this.authService.unlinkSocialAccount(req.user.sub, provider);
    }

    // ─── Get Profile ──────────────────────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Get('me')
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get authenticated user profile',
        description:
            'Returns the profile of the currently authenticated user.\n\n' +
            'Requires a valid **Bearer access token** in the `Authorization` header.',
    })
    @ApiResponse({
        status: 200,
        description: 'User profile returned successfully.',
        schema: {
            example: {
                id: 'clxyz1234abcd',
                email: 'john.doe@example.com',
                name: 'John Doe',
                role: 'USER',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized – access token missing or invalid.' })
    getProfile(@Request() req: any) {
        return this.authService.getProfile(req.user.sub);
    }

    /**
     * POST /api/auth/magic-link
     * Send a passwordless login link to the provided email.
     */
    @Post('magic-link')
    @HttpCode(HttpStatus.OK)
    requestMagicLogin(@Body() dto: RequestMagicLoginDto) {
        return this.authService.requestMagicLogin(dto.email);
    }

    /**
     * POST /api/auth/magic-link/verify
     * Verify the magic JWT from the email link and issue session tokens.
     * If a different account is already logged in → 409 identity_mismatch.
     */
    @Post('magic-link/verify')
    @HttpCode(HttpStatus.OK)
    @UseGuards(OptionalJwtAuthGuard)
    verifyMagicLogin(@Body() dto: VerifyMagicLoginDto, @Request() req: any) {
        const currentUser = req.user ? { id: req.user.sub, email: req.user.email } : undefined;
        return this.authService.verifyMagicLogin(dto.magic, currentUser);
    }
}
