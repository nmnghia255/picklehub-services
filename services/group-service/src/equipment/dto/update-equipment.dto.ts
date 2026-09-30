import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EquipmentCondition } from '@prisma/client';

export class UpdateEquipmentDto {
  @ApiPropertyOptional({
    example: 'Bóng Franklin X-40',
    description: 'Updated name for the equipment.',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    example: 'Hộp mới thay thế cho bóng cũ',
    description: 'Updated description.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 8,
    description:
      'Updated quantity (e.g. reduced after some balls were lost). ' +
      'Updating quantity does NOT retroactively change the linked expense split.',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    enum: EquipmentCondition,
    example: EquipmentCondition.WORN,
    description:
      'Updated physical condition. Typical lifecycle: NEW → GOOD → WORN → RETIRED. ' +
      'Only the owner can change this field.',
  })
  @IsEnum(EquipmentCondition)
  @IsOptional()
  condition?: EquipmentCondition;

  @ApiPropertyOptional({
    example: 150000,
    description: 'Updated total purchase cost for the equipment batch.',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  purchaseCost?: number;
}
