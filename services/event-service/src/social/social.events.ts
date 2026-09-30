export const SOCIAL_WAITLIST_PROMOTED_EVENT =
  'social.waitlist.promoted';

export type SocialWaitlistPromotedEvent = {
  socialId: string;
  userId: string;
  message?: string;
};
