import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsUUID } from "class-validator";

export class ListCreditBalanceQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: "Page number for pagination.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: "Number of items per page for pagination.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: "Minimum credit balance to include.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minCredit?: number;

  @ApiPropertyOptional({
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "Filter a specific user id.",
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
