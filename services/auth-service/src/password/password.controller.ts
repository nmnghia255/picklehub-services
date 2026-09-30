import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { PasswordService } from './password.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Password Management')
@Controller()
export class PasswordController {
    constructor(private readonly passwordService: PasswordService) { }

    // ─── Change Password ──────────────────────────────────────────────────────

    /**
     * Change Password Endpoint
     * Requires authentication (JWT access token)
     */
    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Change account password',
        description:
            'Allows an authenticated user to change their current password.\n\n' +
            '**Requirements:**\n' +
            '- Valid **Bearer access token** in the `Authorization` header.\n' +
            '- The `oldPassword` must match the user\'s current password.\n' +
            '- The `newPassword` must be at least 8 characters.',
    })
    @ApiBody({ type: ChangePasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Password changed successfully.',
        schema: { example: { message: 'Password changed successfully' } },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – validation error or old password does not match.' })
    @ApiResponse({ status: 401, description: 'Unauthorized – access token missing or invalid.' })
    async changePassword(@Request() req: any, @Body() changePasswordDto: ChangePasswordDto) {
        const userId = req.user.sub;
        return this.passwordService.changePassword(userId, changePasswordDto);
    }

    // ─── Forgot Password ──────────────────────────────────────────────────────

    /**
     * Forgot Password Endpoint
     * Public endpoint - no authentication required
     * Temporarily returns reset token (for testing without notification service)
     */
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Request a password reset email',
        description:
            'Sends a password-reset link to the given email address if an account exists.\n\n' +
            '> **Security note:** Always returns a success-like message regardless of whether an account is found, to prevent user enumeration.',
    })
    @ApiBody({ type: ForgotPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Password reset email sent (or silently skipped if email not found).',
        schema: {
            example: {
                message:
                    'If an account with that email exists, a password reset email has been sent.',
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – invalid email format.' })
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.passwordService.forgotPassword(forgotPasswordDto);
    }

    // ─── Reset Password ───────────────────────────────────────────────────────

    /**
     * Reset Password Endpoint
     * Public endpoint - uses token from forgot-password
     */
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Reset password using a reset token',
        description:
            'Sets a new password for the account associated with the provided reset token.\n\n' +
            'The reset token is included in the email link sent by `/api/auth/forgot-password`. ' +
            'Tokens are **single-use** and expire after a limited time.',
    })
    @ApiBody({ type: ResetPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Password reset successfully.',
        schema: { example: { message: 'Password has been reset successfully. You can now log in.' } },
    })
    @ApiResponse({ status: 400, description: 'Bad Request – token is invalid, expired, or already used.' })
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.passwordService.resetPassword(resetPasswordDto);
    }
}
