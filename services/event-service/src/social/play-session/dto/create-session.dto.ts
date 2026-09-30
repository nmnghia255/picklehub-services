import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateSessionDto {
    // Basic Info
    @ApiProperty({
        example: 'Morning Session',
        description: 'Title of the play session.',
    })
    @IsString()
    title!: string;

    // Court Allocation
    @ApiProperty({
        example: ['bookingId1', 'bookingId2'],
        description: 'List of court booking IDs link to this session.',
    })
    @IsArray()
    @IsString({ each: true })
    bookingIds!: string[];


    @ApiPropertyOptional({
        example: 500000,
        description: 'Price of the play session (custom fee defined by host).',
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    sessionFee?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    maxSlots?: number;

    @ApiPropertyOptional({
        example: 20,
        description: 'Maximum number of slots/participants for this session.',
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    maxSlot?: number;
}