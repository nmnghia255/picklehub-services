import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ListLearningScheduleQueryDto } from './list-learning-schedule-query.dto';

export class InternalListLearningScheduleQueryDto extends ListLearningScheduleQueryDto {
  @ApiProperty({
    description: 'Internal-only target learner user UUID.',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
