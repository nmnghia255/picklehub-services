import { PartialType } from '@nestjs/swagger';
import { CreateCoachProfileDto } from './create-coach-profile.dto';

export class UpdateCoachProfileDto extends PartialType(CreateCoachProfileDto) {}
