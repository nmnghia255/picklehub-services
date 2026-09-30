import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class ListCoachLearnersQueryDto {
  @IsOptional()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'class', 'booking'])
  kind?: 'all' | 'class' | 'booking' = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}