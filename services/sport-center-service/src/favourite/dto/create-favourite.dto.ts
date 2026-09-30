import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFavouriteDto {
  @ApiProperty({ example: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', description: 'Sport center ID' })
  @IsUUID()
  @IsNotEmpty()
  centerId: string;
}
