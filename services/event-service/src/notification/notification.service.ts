import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private axiosInstance: AxiosInstance;

    constructor(private configService: ConfigService) {
        const notificationServiceUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL');
        const serviceToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

        this.axiosInstance = axios.create({
            baseURL: notificationServiceUrl,
            headers: {
                'X-Internal-Service-Token': serviceToken,
                'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 seconds timeout
        });
    }

    /**
     * Send verification email
     * @param to - Recipient email
     * @param name - Recipient name
     * @param verificationLink - Verification link
     */
    async sendVerificationEmail(to: string, name: string, verificationLink: string): Promise<void> {
        try {
            await this.axiosInstance.post('/email/send', {
                to,
                template: 'verification',
                context: {
                    name,
                    verificationLink,
                },
            });
            this.logger.log(`Verification email sent to ${to}`);
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Failed to send verification email to ${to}: ${JSON.stringify(error.message)}`);
            } else {
                this.logger.error(`Failed to send verification email to ${to}:`, 'Unknown error');
            }
            // Don't throw error to prevent blocking registration flow
        }
    }

    /**
     * Send welcome email
     * @param to - Recipient email
     * @param name - Recipient name
     */
    async sendWelcomeEmail(to: string, name: string): Promise<void> {
        try {
            await this.axiosInstance.post('/email/send', {
                to,
                template: 'welcome_email',
                context: {
                    name,
                },
            });
            this.logger.log(`Welcome email sent to ${to}`);
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Failed to send welcome email to ${to}: ${JSON.stringify(error.message)}`);
            } else {
                this.logger.error(`Failed to send welcome email to ${to}:`, 'Unknown error');
            }
            // Don't throw error as this is a non-critical email
        }
    }

    /**
     * Send password reset email
     * @param to - Recipient email
     * @param name - Recipient name
     * @param resetLink - Password reset link
     */
    async sendPasswordResetEmail(to: string, name: string, resetLink: string): Promise<void> {
        try {
            await this.axiosInstance.post('/email/send', {
                to,
                template: 'reset_password',
                context: {
                    name,
                    resetLink,
                },
            });
            this.logger.log(`Password reset email sent to ${to}`);
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Failed to send password reset email to ${to}: ${JSON.stringify(error.message)}`);
            } else {
                this.logger.error(`Failed to send password reset email to ${to}:`, 'Unknown error');
            }
            // Don't throw error to prevent blocking password reset flow
        }
    }

    /**
     * Send invitation email with a personalised invite link
     * @param to          - Recipient email address
     * @param inviterName - Display name of the person sending the invite
     * @param invitationLink - Full URL containing the invitation token
     * @param groupName   - Optional group name shown in the email body
     */
    async sendInvitationEmail(
        to: string,
        inviterName: string,
        invitationLink: string,
        groupName?: string,
    ): Promise<void> {
        try {
            await this.axiosInstance.post('/email/send', {
                to,
                template: 'invitation',
                context: {
                    inviterName,
                    invitationLink,
                    groupName: groupName ?? null,
                    groupSuffix: groupName ? `'s group "${groupName}"` : '',
                },
            });
            this.logger.log(`Invitation email sent to ${to}`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(
                    `Failed to send invitation email to ${to}: ${JSON.stringify(error.response?.data)}`,
                );
            } else if (error instanceof Error) {
                this.logger.error(`Failed to send invitation email to ${to}: ${error.message}`);
            } else {
                this.logger.error(`Failed to send invitation email to ${to}:`, 'Unknown error');
            }
            // Re-throw so the caller can surface the failure to the API consumer
            throw error;
        }
    }

    /**
     * Send magic link invitation email for shareable group invites
     * @param to - Recipient email address
     * @param magicLink - Full magic link URL with JWT token
     * @param groupName - Name of the group being joined
     */
    async sendMagicLinkEmail(
        to: string,
        magicLink: string,
        groupName: string,
    ): Promise<void> {
        try {
            await this.axiosInstance.post('/email/send', {
                to,
                template: 'magic_link_invitation',
                context: {
                    magicLink,
                    groupName,
                },
            });
            this.logger.log(`Magic link invitation email sent to ${to} for group: ${groupName}`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(
                    `Failed to send magic link email to ${to}: ${JSON.stringify(error.response?.data)}`,
                );
            } else if (error instanceof Error) {
                this.logger.error(`Failed to send magic link email to ${to}: ${error.message}`);
            } else {
                this.logger.error(`Failed to send magic link email to ${to}:`, 'Unknown error');
            }
            // Re-throw so the caller can surface the failure to the API consumer
            throw error;
        }
    }

    /**
         * Send in-app notifications to all group members
         * @param userIds - Recipient user IDs
         * @param title - Title of the notification
         * @param message - Custom message to include in the notification
         */
    async sendInAppNotification(
        userIds: string[],
        title: string,
        message: string,
    ): Promise<void> {
        try {
            await this.axiosInstance.post('/send', {
                userIds,
                title,
                message,
            });
            this.logger.log(`In-app notification sent to ${userIds.length} members`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(
                    `Failed to send in-app notification: ${error.message}`,
                );

                this.logger.error(
                    `Axios code: ${error.code}`,
                );

                this.logger.error(
                    `Response data: ${JSON.stringify(error.response?.data)}`,
                );
            } else if (error instanceof Error) {
                this.logger.error(
                    `Failed to send in-app notification: ${error.message}`,
                );
            } else {
                this.logger.error(
                    'Failed to send in-app notification: Unknown error',
                );
            }

            throw error;
        }
    }

    /**
     * Send group feed notifications to all group members
     * @param userIds - Recipient user IDs
     * @param title - Title of the notification
     * @param message - Custom message to include in the notification
     */
    async sendGroupFeedNotification(
        userIds: string[],
        title: string,
        message: string,
    ): Promise<void> {
        try {
            await this.axiosInstance.post('/feeds', {
                userIds,
                title,
                message,
            });
            this.logger.log(`Group feed notification sent to ${userIds.length} members`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(
                    `Failed to send group feed notification: ${JSON.stringify(error.response?.data)}`,
                );
            } else if (error instanceof Error) {
                this.logger.error(`Failed to send group feed notification: ${error.message}`);
            } else {
                this.logger.error(`Failed to send group feed notification:`, 'Unknown error');
            }
            throw error;
        }
    }
}
