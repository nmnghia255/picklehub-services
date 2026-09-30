import { IsString, IsNumber, IsOptional, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePrizeDto {
  @ApiProperty({ description: 'The name of the prize', example: 'Giải Nhất' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The type of reward', enum: ['cash', 'voucher', 'merchandise', 'trophy'], example: 'cash' })
  @IsString()
  @IsNotEmpty()
  rewardType: string;

  @ApiProperty({ description: 'The monetary value in VND or cash amount, or 0 if pure trophy/merchandise', example: 5000000 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Description or details of the prize', example: 'Cúp lưu niệm và 5 triệu đồng tiền mặt' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional Event ID link if the prize is event-specific', example: 99911 })
  @IsNumber()
  @IsOptional()
  eventId?: number;
}
