import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ActivityFilterType {
  UPCOMING = 'upcoming',
  PAST = 'past',
}

export class ListGroupActivitiesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: ActivityFilterType })
  @IsOptional()
  @IsEnum(ActivityFilterType)
  type?: ActivityFilterType;

  @ApiPropertyOptional({ description: 'Filter out activities that already have expenses linked' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  hasExpense?: boolean;
}
