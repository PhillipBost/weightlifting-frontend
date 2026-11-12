export interface GamxMetricDefinition {
  title: string;
  ageRange: string;
  description: string;
  methodology: string;
}

// Reference: https://osf.io/wy5mr/wiki?wiki=45jnm
export const GAMX_METHODOLOGY = "GAMX stands for Generalized Additive Model adjusted for seX. The published model standardizes points to a median of 1000 for sex, body mass, and age where applicable.";

export const GAMX_DEFINITIONS: Record<'total' | 's' | 'j' | 'u' | 'a' | 'masters', GamxMetricDefinition> = {
  total: {
    title: "GAMX-Total",
    ageRange: "15–40",
    description: "Compares the two-lift total across body masses and sexes. The total is the best snatch plus the best clean & jerk, each from three attempts. For ages 15–40 and body mass 40 kg or more; based on International Weightlifting Federation Senior World Championships.",
    methodology: `${GAMX_METHODOLOGY} A z-score measures how far a total is from the World Championships mean at the same body weight, in standard deviations.`
  },
  s: {
    title: "GAMX-S (Snatch)",
    ageRange: "15–40",
    description: "Compares the best snatch of three attempts, adjusted for body mass and sex. Based on International Weightlifting Federation Senior World Championships for ages 15–40. The separate GAMX-S-M model adjusts for age as well for Masters ages 30 and older, using International Masters Weightlifting Association World Masters Championships.",
    methodology: GAMX_METHODOLOGY
  },
  j: {
    title: "GAMX-J (Clean & Jerk)",
    ageRange: "15–40",
    description: "Compares the best clean & jerk of three attempts, adjusted for body mass and sex. Based on International Weightlifting Federation Senior World Championships for ages 15–40. The separate GAMX-J-M model adjusts for age as well for Masters ages 30 and older, using International Masters Weightlifting Association World Masters Championships.",
    methodology: GAMX_METHODOLOGY
  },
  u: {
    title: "GAMX-U",
    ageRange: "7–17",
    description: "Compares two-lift totals adjusted for body mass and age for athletes ages 7–17 weighing 25 kg or more. Based on USA Weightlifting national championships.",
    methodology: GAMX_METHODOLOGY
  },
  a: {
    title: "GAMX-A",
    ageRange: "13–40",
    description: "Compares two-lift totals adjusted for body mass and age for Youth, Junior, and Senior athletes ages 13–40 weighing 30 kg or more. Based on International Weightlifting Federation World Championships.",
    methodology: GAMX_METHODOLOGY
  },
  masters: {
    title: "GAMX-Masters",
    ageRange: "30+",
    description: "Compares two-lift totals for Masters athletes ages 30 and older, adjusted for body mass, sex, and age. Based on International Masters Weightlifting Association World Masters Championships.",
    methodology: GAMX_METHODOLOGY
  }
};

