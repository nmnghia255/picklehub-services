import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class ListExpenseQueryDto {
// For pagination
    @ApiPropertyOptional({
        example: 1,
        description: 'Page number for pagination.',
    })
    @IsOptional()
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({
        example: 10,
        description: 'Number of items per page for pagination.',
    })
    @IsOptional()
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
        description: 'Field to sort by.',
    })
    @IsOptional()
    @IsString()
    sortBy?: 'deadline' | 'amount';

    @ApiPropertyOptional({
        example: 'desc',
        description: 'Sort direction.',
    })
    @IsOptional()
    @IsString()
    order?: 'asc' | 'desc';     
}