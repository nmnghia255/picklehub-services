import { IsEmail, IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEmailDto {
    @ApiProperty({
        example: 'example@gmail.com',
        description: 'Recipient email address'
    })
    @IsEmail()
    @IsNotEmpty()
    to: string;

    @ApiProperty({
        example: 'Welcome to Picklehub!',
        description: 'Optional email subject',
        required: false
    })
    @IsString()
    @IsOptional()
    subject?: string;

    @ApiProperty({
        example: 'welcome_email',
        description: 'Name of the email template to use'
    })
    @IsString()
    @IsNotEmpty()
    template: string;

    @ApiProperty({
        example: { name: 'John' },
        description: 'Dynamic variables for the email template'
    })
    @IsObject()
    @IsNotEmpty()
    context: Record<string, any>;
}
