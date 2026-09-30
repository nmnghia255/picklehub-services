import { IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ description: 'A description of the transaction', example: 'Referee payment' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'The transaction type', enum: ['income', 'expense', 'refund'], example: 'expense' })
  @IsEnum(['income', 'expense', 'refund'])
  type: 'income' | 'expense' | 'refund';

  @ApiProperty({ description: 'The monetary amount of the transaction', example: 500000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'The reconciliation status of the transaction', enum: ['completed', 'pending'], example: 'pending' })
  @IsEnum(['completed', 'pending'])
  status: 'completed' | 'pending';
}
