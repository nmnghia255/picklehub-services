import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty({ description: 'The unique transaction ID', example: 101 })
  id: number;

  @ApiProperty({ description: 'The parent tournament ID', example: 1 })
  tournamentId: number;

  @ApiProperty({ description: 'The date and time of the transaction', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  date: Date;

  @ApiProperty({ description: 'Detailed description of the transaction', example: 'Registration fee for Player One - Reg ID: 5' })
  description: string;

  @ApiProperty({ description: 'The type of transaction', enum: ['income', 'expense', 'refund'], example: 'income' })
  type: string;

  @ApiProperty({ description: 'The transaction amount in VND', example: 200000 })
  amount: number;

  @ApiProperty({ description: 'The transaction confirmation status', enum: ['pending', 'verifying', 'completed'], example: 'completed' })
  status: string;
}

export class FinanceSummaryDto {
  @ApiProperty({ description: 'Total completed income in VND', example: 10000000 })
  totalIncome: number;

  @ApiProperty({ description: 'Total completed expenses in VND', example: 3000000 })
  totalExpense: number;

  @ApiProperty({ description: 'Total completed refunds in VND', example: 500000 })
  totalRefund: number;

  @ApiProperty({ description: 'Net profit/loss (Income - Expense - Refund) in VND', example: 6500000 })
  netProfit: number;
}

export class FinanceReportResponseDto {
  @ApiProperty({ description: 'Summary calculations' })
  summary: FinanceSummaryDto;

  @ApiProperty({ description: 'Total count of transactions recorded', example: 25 })
  transactionsCount: number;
}
