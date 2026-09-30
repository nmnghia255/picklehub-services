import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from "class-validator";

export class CreateTransactionDto {
    @ApiProperty({
        example: 500000,
        description: 'Total amount the member is paying',
    })
    @IsInt()
    @Min(0)
    @IsNotEmpty()
    amount!: number;

    @ApiPropertyOptional({
        example: 'https://example.com/receipt.jpg',
        description: 'URL to the payment receipt image',
    })
    @IsString()
    @IsOptional()
    @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
    receiptUrl?: string;
}
