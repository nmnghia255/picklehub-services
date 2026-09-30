import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min, IsString } from 'class-validator';
import { SocialStatus } from '@prisma/client';

export enum MyScheduleTab {
  UPCOMING = 'upcoming',
  HISTORY = 'history',
}

export enum MyScheduleRole {
  HOST = 'host',
  PLAYER = 'player',
}

export class MyScheduleQueryDto {
  @ApiPropertyOptional({
    enum: MyScheduleTab,
    example: MyScheduleTab.UPCOMING,
    description: 'Time to load personal schedule: upcoming or history.',
  })
  @IsOptional()
  @IsEnum(MyScheduleTab)
  tab?: MyScheduleTab;

  @ApiPropertyOptional({
    enum: MyScheduleRole,
    example: MyScheduleRole.PLAYER,
    description: 'Filter personal schedule by host or player role.',
  })
  @IsOptional()
  @IsEnum(MyScheduleRole)
  role?: MyScheduleRole;

  @ApiPropertyOptional({
    enum: SocialStatus,
    example: SocialStatus.PUBLISHED,
    description: 'Filter personal schedule by social status.',
  })
  @IsOptional()
  @IsEnum(SocialStatus)
  status?: SocialStatus;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Pagination page number. Defaults to 1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Pagination page size. Defaults to 20.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: 'friendly doubles',
    description: 'Search keyword in title/note.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
