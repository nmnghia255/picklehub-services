import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Return messages created before this message ID (cursor for infinite scroll).',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({ example: 50, default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Keyword to search in message body (case-insensitive, cannot be combined with before cursor).',
    example: 'court booking',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
