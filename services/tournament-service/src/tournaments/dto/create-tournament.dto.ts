import { IsString, IsInt, IsDateString, IsOptional, Min, Validate } from 'class-validator';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'isBefore', async: false })
export class IsBeforeConstraint implements ValidatorConstraintInterface {
  validate(propertyValue: string, args: ValidationArguments) {
    return propertyValue <= (args.object as Record<string, any>)[args.constraints[0]];
  }
  defaultMessage(args: ValidationArguments) {
    return `"${args.property}" must be before "${args.constraints[0]}"`;
  }
}

export class CreateTournamentDto {
  @ApiProperty({ description: 'The name of the tournament', example: 'Summer Open 2026' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'The location where the tournament will take place', example: 'Central Sports Center' })
  @IsString()
  venue: string;

  @ApiProperty({ description: 'The starting date of the tournament (ISO format)', example: '2026-07-01T08:00:00.000Z' })
  @IsDateString()
  @Validate(IsBeforeConstraint, ['endDate'])
  startDate: string;

  @ApiProperty({ description: 'The ending date of the tournament (ISO format)', example: '2026-07-05T18:00:00.000Z' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'URL of the tournament banner image', example: 'https://example.com/banner.jpg' })
  @IsString()
  @IsOptional()
  banner?: string;

  @ApiPropertyOptional({ description: 'Detailed description of the tournament', example: 'Summer Open 2026 for all skill levels.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'The starting date for registration (ISO format)', example: '2026-06-15T08:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  registrationStartDate?: string;

  @ApiPropertyOptional({ description: 'The ending date for registration (ISO format)', example: '2026-06-30T18:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  registrationEndDate?: string;

  @ApiPropertyOptional({ description: 'Bank name for entry fee payment transfers', example: 'Vietcombank' })
  @IsString()
  @IsOptional()
  paymentBankName?: string;

  @ApiPropertyOptional({ description: 'Bank account owner name', example: 'NGUYEN VAN A' })
  @IsString()
  @IsOptional()
  paymentAccountName?: string;

  @ApiPropertyOptional({ description: 'Bank account number', example: '1029384756' })
  @IsString()
  @IsOptional()
  paymentAccountNumber?: string;

  @ApiPropertyOptional({ description: 'QR code image URL for payments', example: 'https://example.com/qr.jpg' })
  @IsString()
  @IsOptional()
  paymentQrUrl?: string;

  @ApiPropertyOptional({ description: 'Payment instructions or note', example: 'CK cu phap: CK TOURNAMENT [ID] [TEN PLAYER]' })
  @IsString()
  @IsOptional()
  paymentNote?: string;
}