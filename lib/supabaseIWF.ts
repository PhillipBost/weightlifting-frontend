import { createClient } from '@supabase/supabase-js'

const IWF_URL = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL
const IWF_KEY = process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY

if (!IWF_URL || !IWF_KEY) {
  throw new Error('Missing IWF Supabase environment variables (NEXT_PUBLIC_SUPABASE_IWF_URL, NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY)')
}

// No-op storage to completely isolate IWF client from browser storage
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

// Lazy singleton - only create when first accessed
let _supabaseIWF: ReturnType<typeof createClient> | null = null

export const supabaseIWF = new Proxy({} as ReturnType<typeof createClient>, {
  get: (target, prop) => {
    // Lazy initialization on first property access
    if (!_supabaseIWF) {
      _supabaseIWF = createClient(IWF_URL, IWF_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          storageKey: 'supabase-iwf-auth',
          storage: noopStorage
        }
      })
    }
    return (_supabaseIWF as any)[prop]
  }
})

// ============================================================================
// IWF Database Type Definitions
// ============================================================================

/**
 * IWF Lifter/Athlete Profile
 * Maps to USAW 'lifters' table
 */
/**
 * IWF Lifter/Athlete Profile
 * Maps to USAW 'lifters' table
 */
export interface IWFLifter {
  db_lifter_id: number
  iwf_lifter_id: number | null
  iwf_athlete_url: string | null
  athlete_name: string
  gender: 'M' | 'F'
  birth_year: number
  country_code: string
  country_name: string
  created_at: string
  updated_at: string
}

/**
 * IWF Competition/Meet
 * Maps to USAW 'meets' table
 */
/**
 * IWF Competition/Meet
 * Maps to USAW 'meets' table
 */
export interface IWFMeet {
  iwf_meet_id: string
  db_meet_id: number
  meet: string
  level: string
  date: string
  results: string | null
  url: string | null
  batch_id: string | null
  scraped_date: string
  created_at: string
  updated_at: string
}

/**
 * IWF Competition Result
 * Maps to USAW 'meet_results' table
 * Contains full athlete and competition context
 */
/**
 * IWF Competition Result
 * Maps to USAW 'meet_results' table
 * Contains full athlete and competition context
 */
export interface IWFMeetResult {
  db_result_id: number
  db_lifter_id: number
  db_meet_id: number

  // Meet Context
  meet_name: string
  date: string
  level?: string

  // Athlete Context
  lifter_name: string
  gender: 'M' | 'F'
  birth_year: number
  competition_age: number
  country: string
  country_code: string
  country_name: string
  body_weight_kg: string

  // Competition Categories
  age_category: string
  weight_class: string
  competition_group: string
  rank: number

  // Lift Attempts (positive = success, negative = miss)
  snatch_lift_1: string | number | null
  snatch_lift_2: string | number | null
  snatch_lift_3: string | number | null
  best_snatch: string | number | null

  cj_lift_1: string | number | null
  cj_lift_2: string | number | null
  cj_lift_3: string | number | null
  best_cj: string | number | null

  total: string | number | null

  // Analytics (Pre-calculated)
  snatch_successful_attempts: number
  cj_successful_attempts: number
  total_successful_attempts: number

  // Bounce-back Metrics
  bounce_back_snatch_2: boolean | null
  bounce_back_snatch_3: boolean | null
  bounce_back_cj_2: boolean | null
  bounce_back_cj_3: boolean | null

  // Q-Scores
  qpoints: number | null
  q_masters: number | null
  q_youth: number | null

  // Year-to-Date Bests (Note: IWF data doesn't currently populate these)
  best_snatch_ytd: number | null
  best_cj_ytd: number | null
  best_total_ytd: number | null

  // System Fields
  created_at: string
  updated_at: string
  manual_override: boolean

  // Optional joined lifter data
  iwf_lifters?: {
    iwf_lifter_id?: number | null;
  } | null;
}

// ============================================================================
// Query Helper Types
// ============================================================================

/**
 * Extended result type for queries that join with iwf_meets table
 */
export interface IWFResultWithMeetData extends IWFMeetResult {
  iwf_meets?: {
    meet?: string
    level?: string
    date?: string
    url?: string
  } | null
}

export interface IWFResultWithAthleteData extends IWFMeetResult {
  // Can include additional athlete data if needed
}

// Export types for Supabase
export type { User } from '@supabase/supabase-js'
export type { Session } from '@supabase/supabase-js'
