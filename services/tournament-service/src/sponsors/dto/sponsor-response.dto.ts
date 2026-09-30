import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SponsorResponseDto {
  @ApiProperty({ description: 'The unique ID of the sponsor', example: 1 })
  id: number;

  @ApiProperty({ description: 'The parent tournament ID', example: 9991 })
  tournamentId: number;

  @ApiProperty({ description: 'The name of the sponsor', example: 'Nike' })
  name: string;

  @ApiPropertyOptional({ description: 'The image URL for the sponsor logo', example: 'https://example.com/nike.png' })
  logoUrl: string | null;

  @ApiProperty({ description: 'The sponsorship amount', example: 50000000 })
  amount: number;

  @ApiPropertyOptional({ description: 'Sponsor website URL link', example: 'https://nike.com' })
  websiteUrl: string | null;

  @ApiProperty({ description: 'Sponsor record creation timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Sponsor record last update timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  updatedAt: Date;
}
