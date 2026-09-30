import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsDecimal, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateExpenseDto {
    @ApiProperty({
        example: 'Court booking fee for July 2026',
        description: 'Expense title',
        maxLength: 255,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title!: string;

    @ApiPropertyOptional({
        example: 'Expense for court booking fee on 2026-07-15',
        description: 'Optional expense description',
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        example: '100000',
        description: 'Expense amount',
    })
    @IsDecimal({ decimal_digits: '2', force_decimal: false })
    @IsNotEmpty()
    amount!: string;

    @ApiPropertyOptional({
        example: 'https://example.com/receipt.jpg',
        description: 'URL to the expense receipt',
    })
    @IsString()
    @IsOptional()
    @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
    receiptUrl?: string;

    @ApiPropertyOptional({
        example: '2026-07-15',
        description: 'Date of the expense',
    })
    @IsDateString()
    @IsOptional()
    expenseDate?: string;
}