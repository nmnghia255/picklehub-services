import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma.service';
import { SendEmailDto } from './dto/send-email.dto';
import { EmailTemplates, TemplateEngine } from './templates/email.templates';

@Injectable()
export class EmailService {
    private resend: Resend;
    private readonly logger = new Logger(EmailService.name);

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        this.initializeResend();
    }

    /**
     * Initialize Resend client with API key
     */
    private initializeResend() {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');

        if (!apiKey) {
            this.logger.error('RESEND_API_KEY is not configured');
            throw new Error('RESEND_API_KEY environment variable is required');
        }

        this.resend = new Resend(apiKey);
        this.logger.log('Resend client initialized successfully');
    }

    /**
     * Send email using template
     * @param sendEmailDto - Email details
     * @returns Success message
     */
    async sendEmail(sendEmailDto: SendEmailDto) {
        const { to, subject, template, context } = sendEmailDto;

        // Validate template exists
        const validTemplates = Object.keys(EmailTemplates);
        if (!validTemplates.includes(template)) {
            throw new BadRequestException(
                `Invalid template: ${template}. Available templates: ${validTemplates.join(', ')}`,
            );
        }

        const emailTemplate = EmailTemplates[template as keyof typeof EmailTemplates];

        // Use provided subject or template's default subject, then render with context
        const subjectTemplate = subject || emailTemplate.subject;
        const finalSubject = TemplateEngine.render(subjectTemplate, context);

        // Render template with context
        const html = TemplateEngine.render(emailTemplate.html, context);

        const from = this.configService.get<string>('EMAIL_FROM');
        if (!from) {
            throw new BadRequestException('EMAIL_FROM is not configured');
        }

        // Log email attempt
        const logId = await this.logEmail(to, template, 'QUEUED');

        try {
            // Send email using Resend
            const { data, error } = await this.resend.emails.send({
                from,
                to,
                subject: finalSubject,
                html,
            });

            if (error) {
                throw new Error(error.message);
            }

            this.logger.log(`Email sent to ${to}: ${data.id}`);

            // Update log status to SENT
            await this.updateEmailLog(logId, 'SENT', null);

            return {
                message: 'Email sent successfully',
                messageId: data.id,
            };
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}:`, error.message);

            // Update log status to FAILED
            await this.updateEmailLog(logId, 'FAILED', error.message);

            throw new BadRequestException(
                'Failed to send email. Please try again later.',
            );
        }
    }

    /**
     * Log email sending attempt
     * @param recipient - Email recipient
     * @param templateId - Template used
     * @param status - Email status
     * @returns Log ID
     */
    private async logEmail(
        recipient: string,
        templateId: string,
        status: string,
    ): Promise<string> {
        const log = await this.prisma.emailLog.create({
            data: {
                recipient,
                templateId,
                status,
            },
        });

        return log.id;
    }

    /**
     * Update email log status
     * @param id - Log ID
     * @param status - New status
     * @param errorMessage - Error message if failed
     */
    private async updateEmailLog(
        id: string,
        status: string,
        errorMessage: string | null,
    ) {
        await this.prisma.emailLog.update({
            where: { id },
            data: {
                status,
                errorMessage,
            },
        });
    }
}
