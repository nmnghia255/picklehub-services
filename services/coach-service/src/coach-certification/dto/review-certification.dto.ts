import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewCertificationDto {
  @ApiPropertyOptional({ example: 'VERIFIED', description: 'New verification status: VERIFIED | REJECTED.', enum: ['VERIFIED', 'REJECTED'] })
  @IsEnum(['VERIFIED', 'REJECTED'])
  verificationStatus: 'VERIFIED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Certificate documents look authentic and match the issuing organization records.', description: 'Admin review note (optional). Useful especially when rejecting.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
