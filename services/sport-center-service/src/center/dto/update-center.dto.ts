import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCenterDto } from './create-center.dto';

export class UpdateCenterDto extends PartialType(
	OmitType(CreateCenterDto, ['status'] as const),
) {}
