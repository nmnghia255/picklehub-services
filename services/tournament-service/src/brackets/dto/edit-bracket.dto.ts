import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBracketMatchDto {
  @ApiProperty({ description: 'The match ID to update', example: 1001 })
  @IsInt()
  id!: number;

  @ApiProperty({ description: 'The updated team 1 ID, or null', example: 42, nullable: true })
  @IsOptional()
  @IsInt()
  team1Id?: number | null;

  @ApiProperty({ description: 'The updated team 2 ID, or null', example: 43, nullable: true })
  @IsOptional()
  @IsInt()
  team2Id?: number | null;
}

export class EditBracketDto {
  @ApiProperty({ type: [UpdateBracketMatchDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBracketMatchDto)
  matches!: UpdateBracketMatchDto[];
}
