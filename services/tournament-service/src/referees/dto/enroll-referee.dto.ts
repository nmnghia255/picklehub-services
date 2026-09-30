import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class EnrollRefereeDto {
  @ApiProperty({ description: 'The unique ID of the referee user', example: 'referee-uuid-123' })
  @IsString()
  refereeId: string;

  @ApiPropertyOptional({ description: 'The full name of the referee (auto-fetched if omitted)', example: 'John Referee' })
  @IsOptional()
  @IsString()
  refereeName?: string;

  @ApiPropertyOptional({ description: 'The email address of the referee (auto-fetched if omitted)', example: 'ref@picklehub.com' })
  @IsOptional()
  @IsString()
  refereeEmail?: string;

  @ApiPropertyOptional({ description: 'The avatar image URL of the referee (auto-fetched if omitted)', example: 'http://avatar.url/ref.png' })
  @IsOptional()
  @IsString()
  refereeAvatar?: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '0987654321' })
  @IsOptional()
  @IsString()
  phone?: string;
}
