export const SocialErrors = {
  SOCIAL_NOT_FOUND: {
    code: 'SOCIAL_NOT_FOUND',
    message: 'Social not found.',
  },
  SOCIAL_NOT_PARTICIPANT: {
    code: 'SOCIAL_NOT_PARTICIPANT',
    message: 'You are not a participant of this social.',
  },
  SOCIAL_NOT_ORGANIZER: {
    code: 'SOCIAL_NOT_ORGANIZER',
    message: 'Only social organizers can perform this action.',
  },
  SOCIAL_NOT_OWNER: {
    code: 'SOCIAL_NOT_OWNER',
    message: 'Only the social owner can perform this action.',
  },
  SOCIAL_STATUS_NOT_EDITABLE: {
    code: 'SOCIAL_STATUS_NOT_EDITABLE',
    message: 'Social can only be updated when status is ACTIVE or GRACE_PERIOD.',
  },
  SOCIAL_PARTICIPANT_NOT_FOUND: {
    code: 'SOCIAL_PARTICIPANT_NOT_FOUND',
    message: 'Participant not found in this social.',
  },
  SOCIAL_CANNOT_CHANGE_CREATOR_ROLE: {
    code: 'SOCIAL_CANNOT_CHANGE_CREATOR_ROLE',
    message: "The creator's role cannot be changed.",
  },
  SOCIAL_INVALID_ROLE: {
    code: 'SOCIAL_INVALID_ROLE',
    message: 'Role must be MEMBER or ADMIN.',
  },
  SOCIAL_CANNOT_KICK_CREATOR: {
    code: 'SOCIAL_CANNOT_KICK_CREATOR',
    message: 'The social creator cannot be removed.',
  },
  SOCIAL_CREATOR_CANNOT_LEAVE: {
    code: 'SOCIAL_CREATOR_CANNOT_LEAVE',
    message: 'The social creator cannot leave the social.',
  },
  SOCIAL_ORGANIZER_CANNOT_KICK_ORGANIZER: {
    code: 'SOCIAL_ORGANIZER_CANNOT_KICK_ORGANIZER',
    message: 'Social organizers cannot remove other organizers.',
  },
} as const;

export type SocialErrorCode = keyof typeof SocialErrors;
