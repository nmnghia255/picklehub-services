import { IsUUID, IsString, IsNotEmpty, ArrayNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationDto {
    @ApiProperty({
        example: ['user-id-1', 'user-id-2'],
        description: 'Array of user IDs to send notifications to'
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('all', { each: true })
    userIds!: string[]; // Array of user IDs to send notifications to

    @ApiProperty({
        example: 'New Feature Alert!',
        description: 'Title of the in-app notification'
    })
    @IsString()
    @IsNotEmpty()
    title!: string;

    @ApiProperty({
        example: 'Check out our new feature that enhances your experience!',
        description: 'Message content of the in-app notification'
    })
    @IsString()
    @IsNotEmpty()
    message!: string;

    @ApiProperty({
        example: { onClickSupport: { coachProfileId: 'c0000001-c000-4000-8000-000000000001' } },
        description: 'Optional metadata for frontend routing or action handling',
        required: false
    })
    @IsOptional()
    metadata?: Record<string, any>;
}