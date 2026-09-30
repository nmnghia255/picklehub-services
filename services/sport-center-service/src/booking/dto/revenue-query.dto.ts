import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export enum PaymentTransactionStatusQuery {
  PENDING_REVIEW = 'PENDING_REVIEW',
  SETTLED = 'SETTLED',
  REJECTED = 'REJECTED',
  VOIDED = 'VOIDED',
}

export enum PaymentMethodQuery {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}

export class RevenueQueryDto {
  @ApiProperty({ required: false, description: 'Filter by sport center ID' })
  @IsOptional()
  @IsUUID('4')
  centerId?: string;

  @ApiProperty({ required: false, description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, enum: PaymentTransactionStatusQuery })
  @IsOptional()
  @IsEnum(PaymentTransactionStatusQuery)
  status?: PaymentTransactionStatusQuery;

  @ApiProperty({ required: false, enum: PaymentMethodQuery })
  @IsOptional()
  @IsEnum(PaymentMethodQuery)
  method?: PaymentMethodQuery;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class RevenueStatisticsQueryDto {
  @ApiProperty({ required: false, description: 'Filter by sport center ID' })
  @IsOptional()
  @IsUUID('4')
  centerId?: string;

  @ApiProperty({ required: false, description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RevenueExportQueryDto {
  @ApiProperty({ required: false, description: 'Filter by sport center ID' })
  @IsOptional()
  @IsUUID('4')
  centerId?: string;

  @ApiProperty({ required: false, description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, enum: PaymentTransactionStatusQuery })
  @IsOptional()
  @IsEnum(PaymentTransactionStatusQuery)
  status?: PaymentTransactionStatusQuery;

  @ApiProperty({ required: false, enum: PaymentMethodQuery })
  @IsOptional()
  @IsEnum(PaymentMethodQuery)
  method?: PaymentMethodQuery;
}