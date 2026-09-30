import { IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'The plan ID to subscribe to.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  planId: string;

  @ApiPropertyOptional({
    description: 'Whether to auto-renew the subscription when it expires.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
