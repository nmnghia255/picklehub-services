import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCoachRecommendationDto {
  @ApiProperty({ description: 'The user ID of the friend to recommend this coach to', example: 'd3387cc5-cbd4-4832-a22e-d463bb2e2df1' })
  @IsString()
  @IsNotEmpty()
  recommendedToId: string;

  @ApiPropertyOptional({ description: 'Optional message to the friend', example: 'Bạn nên xem qua huấn luyện viên này nhé!' })
  @IsString()
  @IsOptional()
  message?: string;
}
