import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, IsNotEmpty } from 'class-validator';

export class SendGroupNotificationDto {
  @ApiProperty({
    example: 'New group event',
    minLength: 1,
    maxLength: 100,
    description: 'Notification title.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    example: 'We have a new event this Saturday at 8 AM.',
    minLength: 1,
    maxLength: 500,
    description: 'Notification message.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}