import { PartialType } from '@nestjs/swagger';
import { CreateCoachReviewDto } from './create-coach-review.dto';

export class UpdateCoachReviewDto extends PartialType(CreateCoachReviewDto) {}
