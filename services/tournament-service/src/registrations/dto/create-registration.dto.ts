import { IsString, IsNumber, IsOptional, IsEnum, Min, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'The unique ID of the player registering', example: 'user-uuid-1234' })
  @IsString()
  playerId: string;

  @ApiProperty({ description: 'The full name of the registering player', example: 'Jane Doe' })
  @IsString()
  playerName: string;

  @ApiProperty({ description: 'The skill rating (ELO/DUPR) of the registering player', example: 3.8 })
  @IsNumber()
  @Min(0)
  playerRating: number;

  @ApiPropertyOptional({ description: 'The avatar image URL of the registering player', example: 'https://example.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  playerAvatar?: string;

  @ApiProperty({ description: 'The gender of the player registering', enum: ['M', 'F'], example: 'F' })
  @IsEnum(['M', 'F'])
  playerGender: 'M' | 'F';

  @ApiPropertyOptional({ description: 'The age of the player registering', example: 25 })
  @IsInt()
  @Min(0)
  @IsOptional()
  playerAge?: number;

  @ApiPropertyOptional({ description: 'The unique ID of the player\'s partner (if registering for doubles)', example: 'partner-uuid-5678' })
  @IsString()
  @IsOptional()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'The full name of the partner', example: 'John Smith' })
  @IsString()
  @IsOptional()
  partnerName?: string;

  @ApiPropertyOptional({ description: 'The skill rating of the partner', example: 3.9 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  partnerRating?: number;

  @ApiPropertyOptional({ description: 'The avatar image URL of the partner', example: 'https://example.com/partner-avatar.jpg' })
  @IsString()
  @IsOptional()
  partnerAvatar?: string;

  @ApiPropertyOptional({ description: 'The gender of the partner', enum: ['M', 'F'], example: 'M' })
  @IsEnum(['M', 'F'])
  @IsOptional()
  partnerGender?: 'M' | 'F';

  @ApiPropertyOptional({ description: 'The age of the partner', example: 28 })
  @IsInt()
  @Min(0)
  @IsOptional()
  partnerAge?: number;

  @ApiProperty({ description: 'The initial payment status', enum: ['completed', 'pending'], example: 'pending' })
  @IsEnum(['completed', 'pending'])
  paymentStatus: 'completed' | 'pending';

  @ApiPropertyOptional({ description: 'The DUPR ID of the registering player', example: 'DUPR1234567' })
  @IsString()
  @IsOptional()
  playerDuprId?: string;

  @ApiPropertyOptional({ description: 'The DUPR ID of the partner', example: 'DUPR7654321' })
  @IsString()
  @IsOptional()
  partnerDuprId?: string;
}
