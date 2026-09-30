import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNumber } from 'class-validator';

export class BulkAssignRefereeDto {
  @ApiProperty({ description: 'The unique ID of the referee user', example: 'referee-uuid-123' })
  @IsString()
  refereeId: string;

  @ApiProperty({ description: 'List of match IDs to assign this referee to', example: [1, 2, 3] })
  @IsArray()
  @IsNumber({}, { each: true })
  matchIds: number[];
}
