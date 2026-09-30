import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectBookingDto {
  @ApiPropertyOptional({
    example: 'Xin lỗi, tôi đã có lịch bận vào khung giờ đó. Bạn có thể đặt lại vào buổi chiều không?',
    description: 'Optional reason for rejecting the booking request. The learner will see this message.',
  })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
