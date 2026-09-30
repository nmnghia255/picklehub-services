import {
  IsString,
  IsOptional,
  IsUrl,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCertificationDto {
  @ApiProperty({ example: 'USAPA Level 2 Instructor', description: 'Name of the certification.' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'USA Pickleball Association', description: 'Organization that issued the certification.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuingOrganization?: string;

  @ApiPropertyOptional({ example: '2024-03-15', description: 'Date the certification was issued (YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({ example: '2027-03-15', description: 'Expiry date of the certification (YYYY-MM-DD). Omit if it does not expire.' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'https://cdn.picklehub.vn/certs/usapa-l2.pdf', description: 'URL of the certificate document. You can upload files via the media-service, or provide an existing external link (e.g. Google Drive).' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  documentUrl?: string;
}
