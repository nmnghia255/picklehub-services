import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectPaymentDto {
  @ApiPropertyOptional({
    example: 'Ảnh chứng từ không rõ, vui lòng tải lại ảnh khác.',
    description: 'Optional reason why the payment proof was rejected. The learner will see this message.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
