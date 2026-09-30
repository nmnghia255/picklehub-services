import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateFavoriteStatusDto {
  @ApiProperty({ example: true, description: 'Trạng thái yêu thích của vật dụng' })
  @IsBoolean()
  isFavorite!: boolean;
}
