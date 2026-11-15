export interface QScoreMetricDefinition {
  title: string;
  ageRange: string;
  description: string;
  methodology: string;
}

// Reference: https://osf.io/8x3nb/wiki?wiki=7pq5n
export const Q_SCORE_METHODOLOGY =
  "Q-Points use quantile regression to scale two-lift totals for body mass and sex, providing a stable comparison across weight classes without relying on world-record outliers.";

export const Q_SCORE_DEFINITIONS: Record<'qpoints' | 'qyouth' | 'qmasters' | 'best', QScoreMetricDefinition> = {
  qpoints: {
    title: "Q-Points",
    ageRange: "21–30",
    description:
      "Compares two-lift totals across body masses and sexes for lifters ages 21–30.",
    methodology: Q_SCORE_METHODOLOGY,
  },
  qyouth: {
    title: "Q-Youth",
    ageRange: "10–20",
    description:
      "Compares two-lift totals for youth and junior lifters ages 10–20, adjusted for age in addition to body mass and sex.",
    methodology: Q_SCORE_METHODOLOGY,
  },
  qmasters: {
    title: "Q-Masters",
    ageRange: "31+",
    description:
      "Compares two-lift totals for Masters athletes ages 31 and older, adjusting Q-Points with Masters age factors in addition to body mass and sex.",
    methodology: Q_SCORE_METHODOLOGY,
  },
  best: {
    title: "Best Q-Score",
    ageRange: "10+",
    description:
      "The highest available Q-Score across Q-Points (ages 21–30), Q-Youth (ages 10–20), and Q-Masters (ages 31+).",
    methodology: Q_SCORE_METHODOLOGY,
  },
};
