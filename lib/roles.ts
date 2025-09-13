export const ROLES = {
  ADMIN: "admin",
  COACH: "coach",
  PREMIUM: "premium", 
  DEFAULT: "default",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];