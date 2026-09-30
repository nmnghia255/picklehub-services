import { IsNotEmpty, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetBookedSlotsQueryDto {
  @ApiProperty({ description: 'Sport center UUID', example: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a' })
  @IsNotEmpty()
  @IsUUID()
  centerId: string;

  @ApiProperty({ description: 'Date in YYYY-MM-DD format', example: '2026-06-20' })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;
}
