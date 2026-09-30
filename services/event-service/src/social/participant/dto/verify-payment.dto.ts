import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";
import { SocialPaymentStatus } from "@prisma/client";

export class VerifySocialPaymentDto {
    @ApiProperty({ description: 'Payment transaction record UUID' })
    @IsUUID()
    paymentId!: string;

    @ApiProperty({
        example: 'CONFIRMED',
        description: 'Status of the payment transaction:\n' +
            '- `CONFIRMED`: Approved/verified by host\n' +
            '- `REJECTED`: Declined/rejected by host'
    })
    @IsEnum(SocialPaymentStatus)
    status!: SocialPaymentStatus;

    @ApiPropertyOptional({ example: 150000, description: 'Override/verified amount actually received' })
    @IsOptional()
    @IsInt()
    @Min(0)
    amountPaid?: number;
}
