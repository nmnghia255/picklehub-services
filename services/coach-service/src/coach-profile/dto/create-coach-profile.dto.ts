import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCoachProfileDto {
  @ApiProperty({ example: 'Nguyễn Văn Huấn Luyện', description: 'Public display name of the coach.' })
  @IsString()
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({ example: 'Tôi có 5 năm kinh nghiệm huấn luyện Pickleball chuyên nghiệp tại Hà Nội.', description: 'Coach biography shown on the public profile.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'https://cdn.picklehub.vn/avatars/coach1.jpg', description: 'Public URL of the coach avatar image.' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Advanced', description: 'Skill level: Beginner | Intermediate | Advanced | Pro.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @ApiPropertyOptional({ example: 5, description: 'Years of coaching experience.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;

  @ApiPropertyOptional({ example: ['Kỹ thuật serve', 'Dinking', 'Doubles strategy'], description: 'List of coaching specialties.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ example: ['Tiếng Việt', 'English'], description: 'Languages the coach teaches in.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ example: 'Hà Nội', description: 'City where the coach is based.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  locationCity?: string;

  @ApiPropertyOptional({ example: 300000, description: 'Base hourly rate in VND for private bookings.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyRateVnd?: number;

  // ─── Bank info (required at registration) ───

  @ApiProperty({ example: 'Nguyen Van A', description: 'Bank account holder name for payment transfers.' })
  @IsString()
  @MaxLength(255)
  paymentAccountName: string;

  @ApiProperty({ example: '0123456789', description: 'Bank account number.' })
  @IsString()
  @MaxLength(50)
  paymentAccountNumber: string;

  @ApiProperty({ example: 'Techcombank', description: 'Bank name (e.g. Techcombank, VietcomBank, MB Bank).' })
  @IsString()
  @MaxLength(100)
  paymentBankName: string;

  @ApiPropertyOptional({ example: 'https://cdn.picklehub.vn/qr/coach1.png', description: 'URL of the coach\'s bank QR code image for easy payment.' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  paymentQrUrl?: string;
}
