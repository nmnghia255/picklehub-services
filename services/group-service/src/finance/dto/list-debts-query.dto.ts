import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class ListDebtsQueryDto {
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
    example: "Alex",
    description: "Search keyword matching user name or email (case-insensitive).",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
