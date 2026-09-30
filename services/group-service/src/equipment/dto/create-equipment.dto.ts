import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { EquipmentCondition } from '@prisma/client';

export class CreateEquipmentDto {
  @ApiProperty({
    example: 'Bóng Dura 40+',
    description: 'Name of the equipment item or batch.',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: 'Hộp 12 quả dùng cho buổi luyện tập',
    description: 'Optional description of the equipment.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 12,
    description: 'Number of units in this batch (e.g. 12 balls in a box).',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    example: 180000,
    description:
      'Total purchase cost for the whole batch in VND (e.g. price of a full box, not per-unit). ' +
      'This value is used as the totalAmount when auto-creating the linked expense.',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  purchaseCost!: number;

  @ApiPropertyOptional({
    example: '2026-06-20',
    description:
      'ISO date string of when the equipment was purchased. Defaults to now() if omitted.',
  })
  @IsDateString()
  @IsOptional()
  purchasedAt?: string;

  @ApiPropertyOptional({
    enum: EquipmentCondition,
    example: EquipmentCondition.NEW,
    description:
      'Initial physical condition of the equipment. Defaults to NEW if omitted.',
  })
  @IsEnum(EquipmentCondition)
  @IsOptional()
  condition?: EquipmentCondition;

  // ── Auto-expense creation ────────────────────────────────────────────────

  @ApiPropertyOptional({
    example: true,
    description:
      'When true, automatically creates a GroupExpense linked to this equipment purchase. ' +
      'The expense title is auto-generated as "Mua vật dụng: {name}" and the totalAmount ' +
      'equals purchaseCost. Members to charge are controlled by splitAmongAllMembers / memberIds.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  createExpense?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Only relevant when createExpense=true. ' +
      'When true, splits the expense equally among ALL current active members. ' +
      'The required fee per member is floor(purchaseCost / memberCount); ' +
      'the remainder (purchaseCost % memberCount) is assigned to the owner. ' +
      'When false, you must supply an explicit memberIds list.',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  splitAmongAllMembers?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
    ],
    description:
      'Only relevant when createExpense=true AND splitAmongAllMembers=false. ' +
      'Explicit list of member userIds to include in the expense split. ' +
      'All provided IDs must be current members of the group.',
  })
  @IsUUID('4', { each: true })
  @IsOptional()
  memberIds?: string[];
}
