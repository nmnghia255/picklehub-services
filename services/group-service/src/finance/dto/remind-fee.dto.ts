import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

export class RemindFeeDto {
    @ApiPropertyOptional({
        example: ['123e4567-e89b-12d3-a456-426614174000'],
        description: 'List of specific user IDs to remind. If empty, all users with debt > 0 will be reminded.',
    })
    @IsArray()
    @IsString({ each: true })
    @IsUUID('all', { each: true })
    @IsOptional()
    userIds?: string[];

    @ApiPropertyOptional({
        example: true,
        description: 'If true, will send email notifications to reminded users in addition to in-app notifications.',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    sendEmail?: boolean;
}
