import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { TransactionStatus } from "@prisma/client";

export enum VerifyTransactionStatus {
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED'
}

export class VerifyTransactionDto {
    @ApiProperty({
        enum: VerifyTransactionStatus,
        example: VerifyTransactionStatus.VERIFIED,
        description: 'Status of the transaction verification. Allowed values: VERIFIED, REJECTED',
    })
    @IsEnum(VerifyTransactionStatus)
    @IsNotEmpty()
    status!: VerifyTransactionStatus;
}
