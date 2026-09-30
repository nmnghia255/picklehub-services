import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, IsUUID, ValidateNested, IsArray, ArrayMinSize } from 'class-validator';

export class SessionFeeDto {
  @ApiProperty({
    description: 'ID của play session (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  sessionId!: string;

  @ApiProperty({
    description: 'Giá vé lẻ áp dụng cho session này (VNĐ)',
    example: 90000,
  })
  @IsInt()
  @Min(0)
  sessionFee!: number;
}

export class ApplyPricingDto {
  @ApiProperty({
    example: 290000,
    description: 'Giá trọn gói áp dụng cho social (VNĐ).',
  })
  @IsInt()
  @Min(0)
  packageFee!: number;

  @ApiProperty({
    type: [SessionFeeDto],
    description: 'Danh sách giá vé lẻ cho từng session.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SessionFeeDto)
  sessionFees!: SessionFeeDto[];
}
