import { IsUUID, IsString, IsNotEmpty, ArrayNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GroupFeedDto {
    @ApiProperty({
        example: 'group-id-1',
        description: 'group ID to send notifications to'
    })
    @IsUUID()
    groupId!: string; // group IDto send notifications to

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
}