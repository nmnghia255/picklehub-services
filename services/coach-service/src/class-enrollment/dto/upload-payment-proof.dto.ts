import { IsUrl, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadPaymentProofDto {
  @ApiProperty({
    example: 'https://cdn.picklehub.vn/payment-proofs/txn-abc123.jpg',
    description: 'Publicly accessible URL of the payment proof image. Upload the image first via the media-service and pass the URL here.',
  })
  @IsUrl()
  @MaxLength(500)
  paymentProofUrl: string;
}
