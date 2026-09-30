import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PasswordService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private notificationService: NotificationService,
    ) { }

    /**
     * Change password for authenticated user
     * Requires valid old password
     * Optionally revokes all refresh tokens to force re-login on all devices
     */
    async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
        const { oldPassword, newPassword } = changePasswordDto;

        // Fetch user with current password hash
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true }
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('User not found');
        }

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid old password');
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash }
        });

        // Optional: Revoke all refresh tokens for this user to force re-login on all devices
        await this.prisma.refreshToken.deleteMany({
            where: { userId }
        });

        return {
            message: 'Password updated successfully'
        };
    }

    /**
     * Initiate forgot password flow
     * Generates a reset token and stores it in verification_codes table
     * Sends password reset email via notification service
     */
    async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
        const { email } = forgotPasswordDto;

        // Find user by email
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true }
        });

        // For security: Always return success even if user not found (prevent email enumeration)
        if (!user) {
            return {
                message: 'If an account with that email exists, a password reset link has been sent.',
            };
        }

        // Generate secure random token (32 bytes = 64 hex characters)
        const resetToken = randomBytes(32).toString('hex');

        // Set expiration (1 hour from now)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Invalidate any existing unused password reset codes for this user
        await this.prisma.verificationCode.updateMany({
            where: {
                userId: user.id,
                type: 'PASSWORD_RESET',
                used: false
            },
            data: { used: true }
        });

        // Store the reset token
        await this.prisma.verificationCode.create({
            data: {
                userId: user.id,
                code: resetToken,
                type: 'PASSWORD_RESET',
                expiresAt,
                used: false
            }
        });

        // Create password reset link that goes to frontend first
        const frontendUrl = this.configService.get<string>('FRONTEND_URL');
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

        // Send password reset email
        const userName = user.name || email.split('@')[0];
        await this.notificationService.sendPasswordResetEmail(email, userName, resetLink);

        return {
            message: 'If an account with that email exists, a password reset link has been sent.',
        };
    }

    /**
     * Reset password using valid reset token
     * Validates token, updates password, marks token as used, and revokes all sessions
     */
    async resetPassword(resetPasswordDto: ResetPasswordDto) {
        const { token, newPassword } = resetPasswordDto;

        // Find and validate the verification code
        const verificationCode = await this.prisma.verificationCode.findFirst({
            where: {
                code: token,
                type: 'PASSWORD_RESET',
                used: false
            },
            include: {
                user: true
            }
        });

        // Check if token exists
        if (!verificationCode) {
            throw new BadRequestException('Invalid or expired token');
        }

        // Check if token is expired
        if (verificationCode.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired token');
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update user password
        await this.prisma.user.update({
            where: { id: verificationCode.userId },
            data: { passwordHash: newPasswordHash }
        });

        // Mark token as used
        await this.prisma.verificationCode.update({
            where: { id: verificationCode.id },
            data: { used: true }
        });

        // Revoke all refresh tokens to force fresh login
        await this.prisma.refreshToken.deleteMany({
            where: { userId: verificationCode.userId }
        });

        return {
            message: 'Password has been reset successfully. You can now login.'
        };
    }
}
