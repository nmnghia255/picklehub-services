/**
 * Structured error codes for the Invitation domain.
 * Each entry follows the pattern:
 *   code    – machine-readable identifier used by API clients
 *   message – human-readable description shown to end users
 *
 * Naming rules:
 *   - Prefix reflects the domain (INVITATION_* or GROUP_*), not the service.
 *   - Messages are concise; technical detail belongs in documentation.
 */
export const InvitationErrors = {
  // ── Email / identity ────────────────────────────────────────────────────────
  INVITATION_INVALID_EMAIL: {
    code: 'INVITATION_INVALID_EMAIL',
    message: 'Invalid email address.',
  },
  INVITATION_EMAIL_MISMATCH: {
    code: 'INVITATION_EMAIL_MISMATCH',
    message: 'This invitation was sent to a different email.',
  },
  INVITATION_EXISTING_ACCOUNT: {
    code: 'INVITATION_EXISTING_ACCOUNT',
    message: 'Account already exists. Please log in to join the group.',
  },

  // ── Group ────────────────────────────────────────────────────────────────────
  GROUP_NOT_FOUND: {
    code: 'GROUP_NOT_FOUND',
    message: 'Group not found.',
  },
  GROUP_NOT_ADMIN: {
    code: 'GROUP_NOT_ADMIN',
    message: 'Only group admins can send invitations.',
  },
  GROUP_ALREADY_MEMBER: {
    code: 'GROUP_ALREADY_MEMBER',
    message: 'Already a member of this group.',
  },
  GROUP_FULL: {
    code: 'GROUP_FULL',
    message: 'Group has reached its maximum capacity.',
  },

  // ── Invitation lifecycle ─────────────────────────────────────────────────────
  INVITATION_INVITER_NOT_FOUND: {
    code: 'INVITATION_INVITER_NOT_FOUND',
    message: 'Inviter not found.',
  },
  INVITATION_NOT_FOUND: {
    code: 'INVITATION_NOT_FOUND',
    message: 'Invitation not found.',
  },
  INVITATION_ALREADY_PENDING: {
    code: 'INVITATION_ALREADY_PENDING',
    message: 'Invitation already pending.',
  },
  INVITATION_EXPIRED: {
    code: 'INVITATION_EXPIRED',
    message: 'Invitation expired.',
  },
  INVITATION_ALREADY_ACCEPTED: {
    code: 'INVITATION_ALREADY_ACCEPTED',
    message: 'Invitation already accepted.',
  },
  INVITATION_REVOKED: {
    code: 'INVITATION_REVOKED',
    message: 'Invitation revoked.',
  },

  // ── Revocation ─────────────────────────────────────────────────────────────────
  INVITATION_NOT_REVOKABLE: {
    code: 'INVITATION_NOT_REVOKABLE',
    message: 'Only pending invitations can be revoked.',
  },

  // ── Shareable link ───────────────────────────────────────────────────────────
  INVITE_LINK_MAX_USES_REACHED: {
    code: 'INVITE_LINK_MAX_USES_REACHED',
    message: 'This invite link has reached its maximum number of uses.',
  },
  INVITE_LINK_NOT_SHAREABLE: {
    code: 'INVITE_LINK_NOT_SHAREABLE',
    message: 'This token is an email invitation, not a shareable link.',
  },
  INVITE_MAGIC_TOKEN_INVALID: {
    code: 'INVITE_MAGIC_TOKEN_INVALID',
    message: 'Magic link is invalid or has expired.',
  },
} as const;

export type InvitationErrorCode = keyof typeof InvitationErrors;
