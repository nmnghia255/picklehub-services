import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class RefundMemberDto {
  @ApiProperty({
    example: 50000,
    description: 'Refund amount to deduct from member credit balance.',
  })
  @IsInt()
  @Min(0)
  refundAmount!: number;
}
