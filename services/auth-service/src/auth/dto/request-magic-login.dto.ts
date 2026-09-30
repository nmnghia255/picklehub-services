import { IsEmail } from 'class-validator';

export class RequestMagicLoginDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;
}
