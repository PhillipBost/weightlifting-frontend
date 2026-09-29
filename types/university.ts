/**
 * Row shape for `public.usaw_university_programs`.
 * Collegiate status on a club page is derived by joining
 * `associated_usaw_club` to `usaw_clubs.club_name` — there is no flag column
 * on the club itself.
 */
export interface UniversityProgram {
  program_id: number
  school_name: string
  state: string | null
  city: string | null
  /** Canonical club name when linked to a `/club/[slug]` page; null when unlinked. */
  associated_usaw_club: string | null
  /** Full Instagram URL (unlike club rows, which store `@handles`). */
  instagram: string | null
  website_url: string | null
}
