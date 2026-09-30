import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateNested, ArrayMinSize, Min, IsUUID } from "class-validator";
import { Type } from "class-transformer";

export class AllocationItemDto {
    @ApiProperty({
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: 'User ID of the member',
    })
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty({
        example: 50000,
        description: 'Required fee for this member',
    })
    @IsInt()
    @Min(0)
    @IsNotEmpty()
    requiredFee!: number;

    @ApiPropertyOptional({
        example: 2,
        description: 'Number of guests this member brought to this play session',
    })
    @IsInt()
    @Min(0)
    @IsOptional()
    guestCount?: number;

    @ApiPropertyOptional({
        example: 50000,
        description: 'Fee charged per guest',
    })
    @IsInt()
    @Min(0)
    @IsOptional()
    guestFee?: number;
}

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
        example: 100000,
        description: 'Total expense amount',
    })
    @IsInt()
    @Min(0)
    @IsNotEmpty()
    totalAmount!: number;

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

    @ApiProperty({
        type: [AllocationItemDto],
        description: 'List of users and their required fees',
    })
    @ValidateNested({ each: true })
    @Type(() => AllocationItemDto)
    @ArrayMinSize(1)
    allocations!: AllocationItemDto[];

    @ApiPropertyOptional({
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Optional linked activity ID',
    })
    @IsUUID()
    @IsOptional()
    activityId?: string;
}