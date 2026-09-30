import { IsEmail } from 'class-validator';

export class SendGroupInvitationDto {
  /**
   * Email address of the person to invite into the group.
   */
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;
}
