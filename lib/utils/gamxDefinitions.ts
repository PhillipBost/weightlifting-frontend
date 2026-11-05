export interface GamxMetricDefinition {
  title: string;
  ageRange: string;
  description: string;
  methodology: string;
}

export const GAMX_DEFINITIONS: Record<'total' | 's' | 'j' | 'u' | 'a' | 'masters', GamxMetricDefinition> = {
  total: {
    title: "GAMX-Total",
    ageRange: "15–40",
    description: "Age Range: 15–40. Evaluates competition Total (Snatch + Clean & Jerk) adjusted for body mass and sex using Generalized Additive Models (GAMLSS).",
    methodology: "Normalizes performance against international competition reference curves on a unified scale for men and women."
  },
  s: {
    title: "GAMX-S (Snatch)",
    ageRange: "All ages (7+)",
    description: "Age Range: All ages (7+). Evaluates the best successful Snatch adjusted for body mass and sex using Generalized Additive Models (GAMLSS).",
    methodology: "Applies sex-specific smoothing splines to benchmark Snatch performance relative to body mass."
  },
  j: {
    title: "GAMX-J (Clean & Jerk)",
    ageRange: "All ages (7+)",
    description: "Age Range: All ages (7+). Evaluates the best successful Clean & Jerk adjusted for body mass and sex using Generalized Additive Models (GAMLSS).",
    methodology: "Applies sex-specific smoothing splines to benchmark Clean & Jerk performance relative to body mass."
  },
  u: {
    title: "GAMX-U",
    ageRange: "7–20",
    description: "Age Range: 7–20. Evaluates competition performance for athletes ages 7 to 20 adjusted for age, body mass, and sex.",
    methodology: "Evaluates results against age- and sex-specific reference curves using Generalized Additive Models (GAMLSS)."
  },
  a: {
    title: "GAMX-A",
    ageRange: "13–40",
    description: "Age Range: 13–40. Evaluates competition performance for athletes ages 13 to 40 adjusted for age, body mass, and sex.",
    methodology: "Evaluates results against age- and sex-specific reference curves using Generalized Additive Models (GAMLSS)."
  },
  masters: {
    title: "GAMX-Masters",
    ageRange: "30+ (30–92+)",
    description: "Age Range: 30+ (30–92+). Evaluates competition performance for Masters athletes adjusted for age, body mass, and sex.",
    methodology: "Incorporates age-decline curves and body mass modeling using GAMLSS to compare performance across Masters age divisions."
  }
};

