import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmBookingDto {
  @ApiPropertyOptional({
    example: 'Tôi xác nhận buổi tập lúc 9h sáng ngày 20/07. Vui lòng đến sân Pickleball 360.',
    description: 'Optional note from the coach to the learner upon confirmation.',
  })
  @IsOptional()
  @IsString()
  coachNote?: string;
}
