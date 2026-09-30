import { ListGroupsQueryDto } from './list-groups.query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class ListMyGroupsQueryDto extends ListGroupsQueryDto {
  @ApiPropertyOptional({
    enum: ['OWNER', 'MEMBER'],
    example: 'OWNER',
    description: 'Filter groups by caller role.',
  })
  @IsOptional()
  @IsEnum(['OWNER', 'MEMBER'])
  role?: string;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'GRACE_PERIOD', 'FROZEN', 'ARCHIVED'],
    example: 'ACTIVE',
    description: 'Filter groups by status.',
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'GRACE_PERIOD', 'FROZEN', 'ARCHIVED'])
  status?: string;
}
