import { IsOptional, IsInt, Min, Max, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';

export class ListCertificationsQueryDto {
  @ApiPropertyOptional({ enum: VerificationStatus, description: 'Filter by verification status' })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional({ description: 'Filter by coach profile ID' })
  @IsOptional()
  @IsUUID()
  coachProfileId?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number (1-indexed).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Number of certifications per page (max 50).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
