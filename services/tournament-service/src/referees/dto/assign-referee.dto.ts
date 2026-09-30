import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRefereeDto {
  @ApiProperty({ description: 'The unique ID of the referee user', example: 'referee-uuid-999' })
  @IsString()
  refereeId: string;
}
