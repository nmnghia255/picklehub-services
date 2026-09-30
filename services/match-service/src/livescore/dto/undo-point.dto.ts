import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UndoPointDto {
  @ApiProperty({
    example: 'e0000001-e000-4000-8000-000000000000',
    description: 'Match UUID',
  })
  @IsUUID()
  matchId!: string;
}
