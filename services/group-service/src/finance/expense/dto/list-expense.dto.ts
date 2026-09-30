import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, IsUUID, IsIn } from "class-validator";
import { Type } from "class-transformer";

export class ListExpenseQueryDto {
// For pagination
    @ApiPropertyOptional({
        example: 1,
        description: 'Page number for pagination.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({
        example: 10,
        description: 'Number of items per page for pagination.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number;
    
    // Search
    @ApiPropertyOptional({
        example: 'friendly doubles',
        description: 'Search keyword in title/note.',
    })
    @IsOptional()
    @IsString()
    search?: string;

    // Filters
    @ApiPropertyOptional({
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Filter expenses created by a specific user.',
    })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({
        example: 'deadline',
        description: 'Field to sort by. Accepted values: `deadline` (expenseDate), `amount` (totalAmount).',
        enum: ['deadline', 'amount'],
    })
    @IsOptional()
    @IsIn(['deadline', 'amount'])
    sortBy?: 'deadline' | 'amount';

    @ApiPropertyOptional({
        example: 'desc',
        description: 'Sort direction.',
        enum: ['asc', 'desc'],
    })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    order?: 'asc' | 'desc';
}