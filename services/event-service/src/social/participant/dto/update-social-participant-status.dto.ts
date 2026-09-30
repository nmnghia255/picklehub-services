import { ApiProperty } from "@nestjs/swagger";
import { SocialParticipantStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateSocialParticipantStatusDto {
  @ApiProperty({
    enum: SocialParticipantStatus,
    example: SocialParticipantStatus.ON_HOLD,
    description:
      "Target status for the participant. Transitioning to CONFIRMED requires an available slot; transitioning out of CONFIRMED frees a slot and may auto-promote the oldest WAITLISTED participant.",
  })
  @IsEnum(SocialParticipantStatus)
  status!: SocialParticipantStatus;
}
