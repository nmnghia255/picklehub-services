import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Message type. TEXT uses body. MEDIA stores a media-service URL.',
    enum: MessageType,
    example: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  type: MessageType = MessageType.TEXT;

  @ApiPropertyOptional({
    description: 'Text content or media caption. Required for TEXT messages.',
    example: 'See you at 7pm.',
    maxLength: 4000,
  })
  @ValidateIf((dto: SendMessageDto) => dto.type === MessageType.TEXT)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({
    description: 'URL returned by media-service. Required for MEDIA messages.',
    example: 'https://res.cloudinary.com/picklehub/image/upload/chat/photo.jpg',
  })
  @ValidateIf((dto: SendMessageDto) => dto.type === MessageType.MEDIA)
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata for frontend rendering.',
    example: { width: 1200, height: 800 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
