import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ListCoachScheduleQueryDto } from './list-coach-schedule-query.dto';

export class InternalListCoachScheduleQueryDto extends ListCoachScheduleQueryDto {
  @ApiProperty({
    description: 'Internal-only target coach user UUID.',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
