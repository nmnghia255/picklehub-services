import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AddCentersDto {
  @ApiProperty({
    type: [String],
    description: 'Sport-center ids to add to the tournament',
    example: ['9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  centerIds!: string[];
}
