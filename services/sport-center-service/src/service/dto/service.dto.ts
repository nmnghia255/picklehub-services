import { IsString, IsDecimal, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ServiceType } from '@prisma/client';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsEnum(ServiceType)
  type: ServiceType;

  @IsDecimal({ decimal_digits: '0,2' })
  price: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  type?: ServiceType;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  price?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServiceResponseDto {
  id: string;
  centerId: string;
  name: string;
  description?: string;
  type: ServiceType;
  price: number;
  unit?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
