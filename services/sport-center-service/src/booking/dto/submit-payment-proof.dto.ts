import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl, MaxLength } from 'class-validator';

export class SubmitPaymentProofDto {
  @ApiProperty({
    example: 'https://cdn.example.com/proofs/transfer-receipt.jpg',
    description: 'Public URL of the payment proof image (bank transfer screenshot)',
  })
  @IsUrl()
  @IsNotEmpty()
  @MaxLength(500)
  paymentProofUrl!: string;
}
