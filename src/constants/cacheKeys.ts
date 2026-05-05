/**
 * Centralized cache key factory.
 * All node-cache keys must be defined here — no magic strings in controllers.
 */
export const CACHE_KEYS = {
  OTP: (email: string) => `otp:${email}`,
  PASSWORD_RESET: (email: string) => `reset:${email}`,
} as const;
