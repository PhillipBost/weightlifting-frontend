export const ROLES = {
  ADMIN: "admin",
  COACH: "coach",
  USAW_NATIONAL_TEAM_COACH: "usaw_national_team_coach",
  PREMIUM: "premium", 
  DEFAULT: "default",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];