/**
 * IWF Data Adapter Layer
 *
 * Transforms IWF database structure to match USAW structure,
 * enabling reuse of existing USAW components for IWF data.
 */

import type { IWFLifter, IWFMeetResult, IWFResultWithMeetData } from '../supabaseIWF';

// ============================================================================
// Type Definitions for Adapted Data
// ============================================================================

/**
 * Adapted athlete data that matches USAW lifters table structure
 */
export interface AdaptedAthlete {
  lifter_id: number;
  athlete_name: string;
  membership_number: number | null; // N/A for IWF
  gender?: string;
  club?: string; // Maps to country_name for IWF
  wso?: string; // Maps to country_code for IWF
  internal_id?: string | null; // N/A for IWF (use iwf_athlete_url instead)
  iwf_athlete_url?: string | null; // IWF-specific external profile link
  birth_year?: number;
  country_name?: string; // Preserve original for reference
  country_code?: string; // Preserve original for reference
  created_at?: string;
  updated_at?: string;
}

/**
 * Adapted competition result that matches USAW meet_results structure
 */
export interface AdaptedResult {
  result_id: number; // Added: maps to db_result_id
  lifter_id: number;
  lifter_name: string; // Added: athlete's name from database
  date: string;
  meet_name?: string;
  meet_id?: number; // Maps to db_meet_id for IWF
  meets?: { Level?: string };

  // Lift attempts
  snatch_lift_1?: string | number | null;
  snatch_lift_2?: string | number | null;
  snatch_lift_3?: string | number | null;
  best_snatch?: string | number | null;

  cj_lift_1?: string | number | null;
  cj_lift_2?: string | number | null;
  cj_lift_3?: string | number | null;
  best_cj?: string | number | null;

  total?: string | number | null;

  // Analytics
  snatch_successful_attempts?: number;
  cj_successful_attempts?: number;
  total_successful_attempts?: number;

  bounce_back_snatch_2?: boolean | null;
  bounce_back_snatch_3?: boolean | null;
  bounce_back_cj_2?: boolean | null;
  bounce_back_cj_3?: boolean | null;

  // Q-scores (preserved for IWF)
  qpoints?: number | null;
  q_youth?: number | null;
  q_masters?: number | null;

  // Year-to-date bests
  best_snatch_ytd?: number | null;
  best_cj_ytd?: number | null;
  best_total_ytd?: number | null;

  // Athlete context
  gender?: string | null;
  age_category?: string | null;
  competition_age?: number | null;
  weight_class?: string;
  body_weight_kg?: string;

  // Competition context (mapped from country for IWF)
  wso?: string; // Maps to country_code
  club_name?: string; // Maps to country_name
  country_name?: string; // Preserve original
  country_code?: string; // Preserve original

  // IWF-specific fields
  iwf_lifter_id?: number | null;
  competition_group?: string | null;
  rank?: number | null;
}

// ============================================================================
// Adapter Functions
// ============================================================================

/**
 * Adapts IWF athlete data to USAW lifters structure
 *
 * @param iwfLifter - IWF athlete data from iwf_lifters table
 * @returns Adapted athlete data compatible with USAW components
 */
export function adaptIWFAthlete(iwfLifter: IWFLifter): AdaptedAthlete {
  return {
    // Map primary ID
    lifter_id: iwfLifter.db_lifter_id,

    // Basic info
    athlete_name: iwfLifter.athlete_name,
    membership_number: null, // N/A for international athletes
    gender: iwfLifter.gender,
    birth_year: iwfLifter.birth_year,

    // Map country → club/WSO (for display compatibility)
    club: iwfLifter.country_name, // Full country name as requested
    wso: iwfLifter.country_code,

    // Preserve original country data
    country_name: iwfLifter.country_name,
    country_code: iwfLifter.country_code,

    // External links
    internal_id: null, // N/A for IWF
    iwf_athlete_url: iwfLifter.iwf_athlete_url,

    // System fields
    created_at: iwfLifter.created_at,
    updated_at: iwfLifter.updated_at,
  };
}

/**
 * Adapts IWF competition result to USAW meet_results structure
 *
 * @param iwfResult - IWF result data from iwf_meet_results table
 * @returns Adapted result data compatible with USAW components
 */
export function adaptIWFResult(iwfResult: IWFMeetResult): AdaptedResult {
  return {
    // Map primary IDs
    result_id: iwfResult.db_result_id,
    lifter_id: iwfResult.db_lifter_id,
    lifter_name: iwfResult.lifter_name,

    // Meet info
    date: iwfResult.date,
    meet_name: iwfResult.meet_name,
    meet_id: iwfResult.db_meet_id,
    meets: iwfResult.level ? { Level: iwfResult.level } : undefined,

    // Lift attempts (all fields match directly)
    snatch_lift_1: iwfResult.snatch_lift_1,
    snatch_lift_2: iwfResult.snatch_lift_2,
    snatch_lift_3: iwfResult.snatch_lift_3,
    best_snatch: iwfResult.best_snatch,

    cj_lift_1: iwfResult.cj_lift_1,
    cj_lift_2: iwfResult.cj_lift_2,
    cj_lift_3: iwfResult.cj_lift_3,
    best_cj: iwfResult.best_cj,

    total: iwfResult.total,

    // Analytics (all fields match directly)
    snatch_successful_attempts: iwfResult.snatch_successful_attempts,
    cj_successful_attempts: iwfResult.cj_successful_attempts,
    total_successful_attempts: iwfResult.total_successful_attempts,

    bounce_back_snatch_2: iwfResult.bounce_back_snatch_2,
    bounce_back_snatch_3: iwfResult.bounce_back_snatch_3,
    bounce_back_cj_2: iwfResult.bounce_back_cj_2,
    bounce_back_cj_3: iwfResult.bounce_back_cj_3,

    // Q-scores (available for IWF as per user confirmation)
    qpoints: iwfResult.qpoints,
    q_youth: iwfResult.q_youth,
    q_masters: iwfResult.q_masters,

    // Year-to-date bests
    best_snatch_ytd: iwfResult.best_snatch_ytd,
    best_cj_ytd: iwfResult.best_cj_ytd,
    best_total_ytd: iwfResult.best_total_ytd,

    // Athlete context
    gender: iwfResult.gender,
    age_category: iwfResult.age_category,
    competition_age: iwfResult.competition_age,
    weight_class: iwfResult.weight_class,
    body_weight_kg: iwfResult.body_weight_kg,

    // Map country → club/WSO for display compatibility
    club_name: iwfResult.country_name, // Full country name
    wso: iwfResult.country_code,

    // Preserve original country data
    country_name: iwfResult.country_name,
    country_code: iwfResult.country_code,

    // IWF-specific fields
    iwf_lifter_id: (iwfResult.iwf_lifters as any)?.iwf_lifter_id,
    competition_group: iwfResult.competition_group,
    rank: iwfResult.rank,
  };
}

/**
 * Adapts IWF result with joined meet data to USAW structure
 *
 * @param iwfResult - IWF result with iwf_meets join data
 * @returns Adapted result data with meet context
 */
export function adaptIWFResultWithMeetData(iwfResult: IWFResultWithMeetData): AdaptedResult {
  const adapted = adaptIWFResult(iwfResult);

  // Override meet info if joined meet data is available
  if (iwfResult.iwf_meets) {
    adapted.meet_name = iwfResult.iwf_meets.meet || adapted.meet_name;
    adapted.meets = { Level: iwfResult.iwf_meets.level || 'International' };
  }

  return adapted;
}

/**
 * Batch adapter for multiple IWF results
 *
 * @param iwfResults - Array of IWF results
 * @returns Array of adapted results
 */
export function adaptIWFResults(iwfResults: IWFMeetResult[]): AdaptedResult[] {
  return iwfResults.map(adaptIWFResult);
}

/**
 * Batch adapter for multiple IWF results with meet data
 *
 * @param iwfResults - Array of IWF results with meet joins
 * @returns Array of adapted results
 */
export function adaptIWFResultsWithMeetData(iwfResults: IWFResultWithMeetData[]): AdaptedResult[] {
  return iwfResults.map(adaptIWFResultWithMeetData);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if athlete has valid country data
 */
export function hasValidCountryData(athlete: IWFLifter | AdaptedAthlete): boolean {
  return Boolean(
    ('country_name' in athlete && athlete.country_name) ||
    ('club' in athlete && athlete.club)
  );
}

/**
 * Gets display name for athlete's affiliation (country for IWF)
 */
export function getAthleteAffiliation(athlete: IWFLifter | AdaptedAthlete): string {
  if ('country_name' in athlete && athlete.country_name) {
    return athlete.country_name;
  }
  if ('club' in athlete && athlete.club) {
    return athlete.club;
  }
  return 'Unknown';
}

/**
 * Gets display code for athlete's region (country code for IWF)
 */
export function getAthleteRegionCode(athlete: IWFLifter | AdaptedAthlete): string {
  if ('country_code' in athlete && athlete.country_code) {
    return athlete.country_code;
  }
  if ('wso' in athlete && athlete.wso) {
    return athlete.wso;
  }
  return '';
}

/**
 * Checks if result has valid Q-score data
 */
export function hasQScoreData(result: IWFMeetResult | AdaptedResult): boolean {
  return Boolean(
    result.qpoints ||
    result.q_youth ||
    result.q_masters
  );
}

/**
 * Gets the best Q-score from a result
 */
export function getBestQScore(result: IWFMeetResult | AdaptedResult): {
  value: number | null;
  type: 'qpoints' | 'q_youth' | 'q_masters' | 'none';
} {
  const qPoints = result.qpoints || 0;
  const qYouth = result.q_youth || 0;
  const qMasters = result.q_masters || 0;

  if (qPoints >= qYouth && qPoints >= qMasters && qPoints > 0) {
    return { value: qPoints, type: 'qpoints' };
  }
  if (qYouth >= qMasters && qYouth > 0) {
    return { value: qYouth, type: 'q_youth' };
  }
  if (qMasters > 0) {
    return { value: qMasters, type: 'q_masters' };
  }

  return { value: null, type: 'none' };
}
