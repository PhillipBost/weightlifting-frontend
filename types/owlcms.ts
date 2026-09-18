/**
 * OWLCMS Database Types & Interfaces
 * Matches public.owlcms_meets, public.owlcms_lifters, and public.owlcms_meet_results
 */

export interface OwlcmsMeetResult {
  result_id: number;
  meet_id: number;
  lifter_id: number;
  gender: 'M' | 'F' | null;
  birth_year: number | null;
  competition_age: number | null;
  body_weight_kg: number | null;
  scale_weight_kg: number | null;
  category: string;
  session_name: string | null;
  lot_number: number | null;
  start_number: number | null;
  snatch_1: number | null;
  snatch_2: number | null;
  snatch_3: number | null;
  best_snatch: number | null;
  snatch_1_time?: string | null;
  snatch_2_time?: string | null;
  snatch_3_time?: string | null;
  cj_1: number | null;
  cj_2: number | null;
  cj_3: number | null;
  best_cj: number | null;
  cj_1_time?: string | null;
  cj_2_time?: string | null;
  cj_3_time?: string | null;
  total: number | null;
  snatch_successful_attempts: number;
  cj_successful_attempts: number;
  total_successful_attempts: number;
  bounce_back_snatch_2: boolean | null;
  bounce_back_snatch_3: boolean | null;
  bounce_back_cj_2: boolean | null;
  bounce_back_cj_3: boolean | null;
  gamx_u: number | null;
  gamx_a: number | null;
  gamx_masters: number | null;
  gamx_total: number | null;
  gamx_s: number | null;
  gamx_j: number | null;
  qpoints: number | null;
  q_masters: number | null;
  q_youth: number | null;
  best_snatch_ytd: number | null;
  best_cj_ytd: number | null;
  best_total_ytd: number | null;
  eligible_for_individual_ranking?: boolean;
  ranking_status_reason?: string | null;
  participations: Array<{
    categoryCode: string;
    snatchRank: number;
    cleanJerkRank: number;
    totalRank: number;
    teamMember: boolean;
    championshipType: string;
  }>;
  raw_payload: any;
}

export interface OwlcmsMeet {
  meet_id: number;
  meet_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  organizer: string | null;
  format_version: string;
  source_file_name: string;
  uploaded_by?: string | null;
  uploader_email?: string | null;
  uploader_ip?: string | null;
  raw_storage_path?: string | null;
  raw_storage_bytes?: number | null;
  raw_storage_hash?: string | null;
  raw_payload_hash?: string | null;
  raw_payload: any;
  status?: 'published' | 'pending_review' | 'rejected' | 'superseded';
  parent_meet_id?: number | null;
  revision_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OwlcmsLifter {
  lifter_id: number;
  athlete_name: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  birth_year: number | null;
  exact_birth_date: string | null;
  country_code: string | null;
  club_name: string | null;
  membership_number: string | null;
  raw_payload: any;
  created_at?: string;
  updated_at?: string;
}
