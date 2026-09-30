import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTransactionStatusDto {
  @ApiProperty({ description: 'The updated reconciliation status', enum: ['completed', 'pending', 'verifying'], example: 'completed' })
  @IsEnum(['completed', 'pending', 'verifying'])
  status: 'completed' | 'pending' | 'verifying';
}
