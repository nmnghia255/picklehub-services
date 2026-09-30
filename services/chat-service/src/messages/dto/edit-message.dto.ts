import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @ApiProperty({
    description: 'New text content for the message. Only TEXT messages can be edited.',
    example: 'See you at 8pm instead!',
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({
    description: 'Optional structured metadata to update.',
    example: null,
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
