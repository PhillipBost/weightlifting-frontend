/**
 * Raw `public.usaw_clubs` row shape for fields consumed by the frontend.
 * `community_designation` is the sole source of truth for specialty badges
 * (byte-verbatim from the USAW source table). `is_bipoc_owned` /
 * `is_lgbtqia_owned` are deprecated backend columns and are never read here.
 */
export interface UsawClub {
  club_name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  geocode_display_name: string | null
  wso_geography: string | null
  active_lifters_count: number | null
  contact_name: string | null
  email: string | null
  phone: string | null
  instagram: string | null
  website_url: string | null
  community_designation: string | null
}

/** Club row as transformed for the `/club` directory map/list. */
export interface ClubLocationEntry {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  city: string
  state: string
  recentMemberCount: number
  /** Verbatim `community_designation` string, or null when not designated. */
  communityDesignation: string | null
  /** True when the club is linked to a row in `usaw_university_programs`. */
  isCollegiate: boolean
}
