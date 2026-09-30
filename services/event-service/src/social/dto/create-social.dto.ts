import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { SocialFormat } from '@prisma/client';

export enum SocialFeeModeDto {
  NONE = 'NONE',
  FREE = 'FREE',
  AUTO_SPLIT_TOTAL = 'AUTO_SPLIT_TOTAL',
  PER_PERSON = 'PER_PERSON',
}

export enum SocialGenderPolicyDto {
  ANY = 'ANY',
  MALE_ONLY = 'MALE_ONLY',
  FEMALE_ONLY = 'FEMALE_ONLY',
  MIXED_ONLY = 'MIXED_ONLY',
}

export enum SocialAgeGroupDto {
  ANY = 'ANY',
  JUNIOR = 'JUNIOR',
  ADULT = 'ADULT',
  SENIOR = 'SENIOR',
}

export enum SocialHostRoleDto {
  HOST_ONLY = 'HOST_ONLY',
  HOST_AND_PLAY = 'HOST_AND_PLAY',
}

export class CreateSocialDto {
  @ApiProperty({
    example: 'Weekend Social',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    example: 'Bring your own paddle. Friendly mixed-level games.\n Remember to pay fee.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: '2026-03-28T07:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    example: '2026-03-28T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    enum: SocialFormat,
    example: SocialFormat.SOCIAL,
    description: 'Social play format.',
  })
  @IsOptional()
  @IsEnum(SocialFormat)
  format?: SocialFormat;


  @ApiPropertyOptional({
    example: false,
    description: 'Đánh dấu sự kiện miễn phí',
  })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;


  @ApiPropertyOptional({
    example: true,
    description: 'Enable DUPR submission for this social.',
  })
  @IsOptional()
  @IsBoolean()
  submitDupr?: boolean;

  @ApiPropertyOptional({
    example: 2.5,
    description: 'Minimum skill level accepted for this social.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumLevel?: number;

  @ApiPropertyOptional({
    example: 4.0,
    description: 'Maximum skill level accepted for this social.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumLevel?: number;

  @ApiPropertyOptional({
    enum: SocialGenderPolicyDto,
    example: SocialGenderPolicyDto.ANY,
    description: 'Optional participant gender policy.',
  })
  @IsOptional()
  @IsEnum(SocialGenderPolicyDto)
  genderPolicy?: SocialGenderPolicyDto;

  @ApiPropertyOptional({
    enum: SocialAgeGroupDto,
    example: SocialAgeGroupDto.ANY,
    description: 'Optional participant age group.',
  })
  @IsOptional()
  @IsEnum(SocialAgeGroupDto)
  ageGroup?: SocialAgeGroupDto;

  @ApiPropertyOptional({
    enum: SocialHostRoleDto,
    example: SocialHostRoleDto.HOST_AND_PLAY,
    description: 'Host participation role in this social.',
  })
  @IsOptional()
  @IsEnum(SocialHostRoleDto)
  hostRole?: SocialHostRoleDto;

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

  @ApiPropertyOptional({
    example: 100000,
    description: 'Package fee of the social for full-package participants.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  packageFee?: number;
}
