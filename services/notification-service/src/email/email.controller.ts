import {
    Controller,
    Post,
    Body,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { ApiSecurity } from '@nestjs/swagger';

/**
 * Email controller
 * Handles email sending operations for internal services
 */
@Controller(['/notification/email', '/notifications/email'])
@UseGuards(InternalServiceGuard)
@ApiSecurity('internal-token')
export class EmailController {
    constructor(private readonly emailService: EmailService) { }

    /**
     * Send email endpoint
     * Protected by InternalServiceGuard - requires X-Internal-Service-Token header
     * @param sendEmailDto - Email details
     * @returns Success response
     */
    @Post('send')
    async sendEmail(@Body(ValidationPipe) sendEmailDto: SendEmailDto) {
        return this.emailService.sendEmail(sendEmailDto);
    }
}
