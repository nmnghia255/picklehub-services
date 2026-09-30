import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";
import { TransactionStatus } from "@prisma/client";

export class ListTransactionQueryDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;

    @ApiPropertyOptional({ 
        description: 'Filter by transaction status. Allowed values: PENDING_REVIEW, VERIFIED, REJECTED', 
        enum: TransactionStatus 
    })
    @IsOptional()
    @IsEnum(TransactionStatus)
    status?: TransactionStatus;
}
