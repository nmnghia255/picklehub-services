import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class FinanceSummaryQueryDto {
    @ApiPropertyOptional({
        example: '2026-01-01',
        description: 'Start date for the summary (inclusive). Format: YYYY-MM-DD',
    })
    @IsOptional()
    @IsDateString()
    fromDate?: string; // ISO date string

    @ApiPropertyOptional({
        example: '2026-12-31',
        description: 'End date for the summary (inclusive). Format: YYYY-MM-DD',
    })
    @IsOptional()
    @IsDateString()
    toDate?: string;   // ISO date string
}