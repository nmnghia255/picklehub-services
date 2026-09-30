import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { MessageType } from '@prisma/client';

export class ConversationEventDto {
  @IsUUID()
  conversationId: string;
}

export class RealtimeSendMessageDto extends ConversationEventDto {
  @IsEnum(MessageType)
  type: MessageType = MessageType.TEXT;

  @ValidateIf((dto: RealtimeSendMessageDto) => dto.type === MessageType.TEXT)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body?: string;

  @ValidateIf((dto: RealtimeSendMessageDto) => dto.type === MessageType.MEDIA)
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RealtimeMarkReadDto extends ConversationEventDto {
  @IsUUID()
  messageId: string;
}
