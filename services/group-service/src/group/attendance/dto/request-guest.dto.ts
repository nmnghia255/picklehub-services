import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestGuestDto {
  @ApiProperty({
    description: 'Number of guests requested',
    minimum: 1,
    example: 2,
  })
  @IsInt()
  @Min(1)
  guestCount: number;
}
