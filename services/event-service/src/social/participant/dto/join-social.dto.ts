import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class JoinSocialDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the participant joins the full package of the social.',
  })
  @IsOptional()
  @IsBoolean()
  isFullPackage?: boolean;
}
