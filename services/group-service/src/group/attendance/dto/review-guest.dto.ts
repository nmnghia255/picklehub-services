import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GuestReviewStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewGuestDto {
  @ApiProperty({
    description: 'Review decision for guest request',
    enum: GuestReviewStatus,
    example: 'APPROVED',
  })
  @IsEnum(GuestReviewStatus)
  status: GuestReviewStatus;
}
