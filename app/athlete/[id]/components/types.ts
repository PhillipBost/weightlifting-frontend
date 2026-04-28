export interface MedalSummary {
  gold: number;
  silver: number;
  bronze: number;
}

export interface MedalCounts {
  total_lift: number;
  snatch: number;
  cj: number;
  combined_total: number;
}

export interface AchievementMedal {
  result_id: number;
  meet_id: string;
  meet_name: string;
  date: string;
  level: string;
  division: string;
  ranks: {
    total_lift: number;
    snatch: number;
    cj: number;
  };
}

export interface AthleteAchievementsData {
  summary: MedalSummary;
  medal_counts: {
    gold: MedalCounts;
    silver: MedalCounts;
    bronze: MedalCounts;
  };
  levels: {
    local: MedalSummary;
    national: MedalSummary;
    international: MedalSummary;
  };
  medals: AchievementMedal[];
}
