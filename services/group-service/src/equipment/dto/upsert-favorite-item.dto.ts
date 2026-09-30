import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { EquipmentCondition, FavoriteQuantityType } from '@prisma/client';

export class UpsertFavoriteItemDto {
  @ApiProperty({ example: 'Bóng Dura 40+' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 12 })
  @IsInt()
  @Min(1)
  @IsOptional()
  defaultQuantity?: number;

  @ApiPropertyOptional({ enum: FavoriteQuantityType, example: FavoriteQuantityType.NUMBER })
  @IsEnum(FavoriteQuantityType)
  @IsOptional()
  defaultQuantityType?: FavoriteQuantityType;

  @ApiPropertyOptional({ enum: EquipmentCondition, example: EquipmentCondition.NEW })
  @IsEnum(EquipmentCondition)
  @IsOptional()
  defaultCondition?: EquipmentCondition;

  @ApiPropertyOptional({ example: 180000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  defaultCost?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
