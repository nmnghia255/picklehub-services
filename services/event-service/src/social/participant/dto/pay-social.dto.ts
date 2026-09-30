import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUrl, Min } from "class-validator";

export class PaySocialDto {
    @ApiProperty({ example: 150000, description: 'Amount submitted in this transaction' })
    @IsInt()
    @Min(1)
    amount!: number;

    @ApiPropertyOptional({ example: 'https://example.com/receipt.jpg', description: 'Transaction receipt image URL' })
    @IsString()
    @IsOptional()
    @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
    receiptUrl?: string;
}
