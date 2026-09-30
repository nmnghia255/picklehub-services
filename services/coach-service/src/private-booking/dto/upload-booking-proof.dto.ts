import { IsUrl, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadBookingProofDto {
  @ApiProperty({
    example: 'https://cdn.picklehub.vn/payment-proofs/booking-txn-xyz789.jpg',
    description: 'Publicly accessible URL of the bank transfer proof image. Upload via media-service first, then pass the returned URL here.',
  })
  @IsUrl()
  @MaxLength(500)
  paymentProofUrl: string;
}
