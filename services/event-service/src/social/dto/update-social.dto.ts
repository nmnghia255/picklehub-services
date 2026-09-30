import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SocialAgeGroupDto,
  SocialGenderPolicyDto,
} from './create-social.dto'; 1
import { SocialFormat, SocialStatus } from '@prisma/client';

export class UpdateSocialDto {
  // Basic info
  @ApiPropertyOptional({
    example: 'Evening Singles Session',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'Bring your own paddle.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    enum: SocialFormat,
    example: SocialFormat.SOCIAL,
    description: 'Session play format.',
  })
  @IsOptional()
  @IsEnum(SocialFormat)
  format?: SocialFormat;



  // Filters

  @ApiPropertyOptional({
    example: false,
    description: 'Mark social as free',
  })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @ApiPropertyOptional({
    example: 2.5,
    description: 'Minimum skill level accepted for this session.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumLevel?: number;

  @ApiPropertyOptional({
    example: 4.0,
    description: 'Maximum skill level accepted for this session.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumLevel?: number;

  @ApiPropertyOptional({
    enum: SocialGenderPolicyDto,
    example: SocialGenderPolicyDto.FEMALE_ONLY, // ANY, MALE_ONLY, FEMALE_ONLY, MIXED_ONLY
    description: 'Optional participant gender policy.',
  })
  @IsOptional()
  @IsEnum(SocialGenderPolicyDto)
  genderPolicy?: SocialGenderPolicyDto;

  @ApiPropertyOptional({
    enum: SocialAgeGroupDto,
    example: SocialAgeGroupDto.SENIOR, // ANY, JUNIOR, ADULT, SENIOR
    description: 'Optional participant age group.',
  })
  @IsOptional()
  @IsEnum(SocialAgeGroupDto)
  ageGroup?: SocialAgeGroupDto;

  // Settings


  @ApiPropertyOptional({
    example: true,
    description: 'Enable DUPR submission for this session.',
  })
  @IsOptional()
  @IsBoolean()
  submitDupr?: boolean;

  @ApiPropertyOptional({
    example: 2,
    minimum: 0,
    description: 'Per-session cancellation freeze window in hours before start.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationFreezeHours?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Auto-approve join requests. False means requests need manual review.',
  })
  @IsOptional()
  @IsBoolean()
  autoApproveJoinRequests?: boolean;

  // Payment
  @ApiPropertyOptional({
    example: 1000000,
    description: 'Total expense for the session in VND. Enter by host.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalExpense?: number;

  @ApiPropertyOptional({
    example: 'Vietcombank',
    description: 'Optional bank name for payment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentBankName?: string;

  @ApiPropertyOptional({
    example: 'NGUYEN VAN A',
    description: 'Optional payment account holder name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentAccountName?: string;

  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Optional payment account number shown to participants.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentAccountNumber?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.picklehub.vn/payments/session-qr.png',
    description: 'Optional QR image/link for participant payment.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  paymentQrUrl?: string;

  @ApiPropertyOptional({
    example: 'Transfer content: SESSION A222 + your phone number',
    description: 'Optional payment instructions/note for participants.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentNote?: string;

  // Status
  @ApiPropertyOptional({
    example: 'PUBLISHED', // DRAFT, PUBLISHED, CANCELLED, COMPLETED
    description: 'Current status of the social session.',
  })
  @IsOptional()
  @IsEnum(SocialStatus)
  status?: SocialStatus;

  @ApiPropertyOptional({
    example: 100000,
    description: 'Package fee of the social for full-package participants.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  packageFee?: number;
}
