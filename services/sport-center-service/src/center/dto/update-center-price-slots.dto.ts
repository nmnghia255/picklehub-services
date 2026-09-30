import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateCenterPriceSlotDto } from './create-center-price-slot.dto';

export class UpdateCenterPriceSlotsDto {
  @ApiProperty({ type: [CreateCenterPriceSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCenterPriceSlotDto)
  priceSlots!: CreateCenterPriceSlotDto[];
}
