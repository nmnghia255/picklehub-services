import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSponsorDto {
  @ApiProperty({ description: 'The name of the sponsor', example: 'Nike' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'The image URL for the sponsor logo', example: 'https://example.com/nike.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({
    description: 'The sponsorship amount',
    example: 50000000,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Sponsor website URL link', example: 'https://nike.com' })
  @IsString()
  @IsOptional()
  websiteUrl?: string;
}
