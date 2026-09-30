import { IsEnum, IsOptional } from 'class-validator';
import { RegistrationStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRegistrationDto {
  @ApiPropertyOptional({
    description: 'The updated registration approval status',
    enum: RegistrationStatus,
    example: 'approved',
  })
  @IsEnum(RegistrationStatus)
  @IsOptional()
  status?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'The updated payment status',
    enum: ['completed', 'pending', 'verifying'],
    example: 'completed',
  })
  @IsEnum(['completed', 'pending', 'verifying'])
  @IsOptional()
  paymentStatus?: 'completed' | 'pending' | 'verifying';
}
