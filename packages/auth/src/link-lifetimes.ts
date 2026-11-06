/** Seconds each e-mailed link stays valid. Better Auth enforces them and the e-mails print them. */
const LINK_LIFETIME_SECONDS = {
  emailVerification: 60 * 60,
  invitation: 60 * 60 * 24 * 7,
  magicLink: 60 * 5,
  passwordReset: 60 * 60,
} as const;

export { LINK_LIFETIME_SECONDS };
