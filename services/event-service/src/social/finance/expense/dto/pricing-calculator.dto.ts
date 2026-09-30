import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, IsUUID, ValidateNested, IsArray } from 'class-validator';

export class SessionOverrideDto {
  @ApiProperty({
    description: 'ID của play session (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  sessionId!: string;

  @ApiPropertyOptional({
    description: 'Giá vé lẻ đề xuất ghi đè cho session này',
    example: 80000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  suggestedPrice?: number;
}

export class PricingCalculatorDto {
  @ApiProperty({
    example: 8,
    description: 'Số lượng người chơi mục tiêu để chia đều chi phí.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetPlayers!: number;

  @ApiPropertyOptional({
    example: 250000,
    description: 'Giá trọn gói do Host tự cấu hình/ghi đè.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  suggestedPackagePrice?: number;

  @ApiPropertyOptional({
    type: [SessionOverrideDto],
    description: 'Danh sách ghi đè giá của từng session lẻ.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionOverrideDto)
  sessionOverrides?: SessionOverrideDto[];
}
