import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateGroupActivityDto } from './create-group-activity.dto';
import { GroupActivityStatus } from '@prisma/client';

export class UpdateGroupActivityDto extends PartialType(CreateGroupActivityDto) {
  @ApiPropertyOptional({ enum: GroupActivityStatus })
  @IsOptional()
  @IsEnum(GroupActivityStatus)
  status?: GroupActivityStatus;
}
