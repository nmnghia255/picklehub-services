import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class SubmitPaymentProofDto {
  @ApiProperty({
    description: 'The URL of the uploaded payment proof image (receipt/screenshot)',
    example: 'https://example.com/payment-proofs/receipt-123.jpg',
  })
  @IsString()
  @IsUrl()
  paymentProofUrl: string;
}
