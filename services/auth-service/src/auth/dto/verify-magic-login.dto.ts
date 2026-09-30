import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyMagicLoginDto {
  @IsString()
  @IsNotEmpty()
  magic: string;
}
