export const GroupErrors = {
  GROUP_NOT_FOUND: {
    code: 'GROUP_NOT_FOUND',
    message: 'Group not found.',
  },
  GROUP_NOT_MEMBER: {
    code: 'GROUP_NOT_MEMBER',
    message: 'You are not a member of this group.',
  },
  GROUP_NOT_OWNER: {
    code: 'GROUP_NOT_OWNER',
    message: 'Only the group owner can perform this action.',
  },
  GROUP_STATUS_NOT_EDITABLE: {
    code: 'GROUP_STATUS_NOT_EDITABLE',
    message: 'Group can only be updated when status is ACTIVE or GRACE_PERIOD.',
  },
  GROUP_MEMBER_NOT_FOUND: {
    code: 'GROUP_MEMBER_NOT_FOUND',
    message: 'Member not found in this group.',
  },
  GROUP_CANNOT_CHANGE_OWNER_ROLE: {
    code: 'GROUP_CANNOT_CHANGE_OWNER_ROLE',
    message: "The owner's role cannot be changed.",
  },
  GROUP_INVALID_ROLE: {
    code: 'GROUP_INVALID_ROLE',
    message: 'Role must be MEMBER.',
  },
  GROUP_CANNOT_KICK_OWNER: {
    code: 'GROUP_CANNOT_KICK_OWNER',
    message: 'The group owner cannot be removed.',
  },
  GROUP_OWNER_CANNOT_LEAVE: {
    code: 'GROUP_OWNER_CANNOT_LEAVE',
    message: 'You are the only owner. Transfer ownership before leaving.',
  },
} as const;

export type GroupErrorCode = keyof typeof GroupErrors;
