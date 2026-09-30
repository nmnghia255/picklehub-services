import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class RefundSocialPaymentDto {
    @ApiProperty({ example: 50000, description: 'Amount to refund to the participant' })
    @IsInt()
    @Min(1)
    amount!: number;
}
