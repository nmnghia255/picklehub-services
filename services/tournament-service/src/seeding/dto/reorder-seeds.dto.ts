import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class SeedOrderItemDto {
  @ApiProperty({ description: 'The team id to position', example: 42 })
  @IsInt()
  teamId!: number;

  @ApiProperty({ description: 'The seed number to assign (1 = top seed)', example: 1 })
  @IsInt()
  @Min(1)
  seed!: number;
}

/**
 * Batch reorder payload — the full ordered list, saved in one request (e.g. after a
 * drag-and-drop completes), not one call per seed.
 */
export class ReorderSeedsDto {
  @ApiProperty({ type: [SeedOrderItemDto], description: 'Every seed with its new position' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SeedOrderItemDto)
  seeds!: SeedOrderItemDto[];
}
