/**
 * Specialty-club badge + filter helpers.
 *
 * Ground rules (per backend handoff):
 * - `community_designation` is the SOLE source of truth for badges. It is
 *   rendered byte-verbatim (casing, `owned` suffix, slashes preserved) —
 *   text-only, no emojis, no canonicalization, no label merging.
 * - `is_bipoc_owned` / `is_lgbtqia_owned` are deprecated and MUST NOT be read
 *   for any logic. Filters match on designation TEXT instead.
 * - Collegiate status derives from the `usaw_university_programs` join
 *   (`associated_usaw_club = club_name`), not from any club flag.
 */

export type ClubFilterKey = 'all' | 'collegiate' | 'bipoc' | 'lgbtqia'

export const CLUB_FILTER_LABELS: Record<ClubFilterKey, string> = {
    all: 'All Clubs',
    collegiate: 'Collegiate',
    bipoc: 'BIPOC',
    lgbtqia: 'LGBTQIA+',
}

// Tokens implying a BIPOC-related designation. Matched case-insensitively
// against the verbatim `community_designation` string only.
const BIPOC_TOKENS = [
    'bipoc',
    'black',
    'brown',
    'latina',
    'latino',
    'latinx',
    'asian',
    'native',
    'indigenous',
    'people of color',
]

/** True when a designation string belongs in the BIPOC filter. */
export function matchesBipocDesignation(designation: string | null | undefined): boolean {
    if (!designation) return false
    const lower = designation.toLowerCase()
    return BIPOC_TOKENS.some(token => lower.includes(token))
}

/** True when a designation string belongs in the LGBTQIA+ filter. */
export function matchesLgbtqiaDesignation(designation: string | null | undefined): boolean {
    if (!designation) return false
    return designation.toLowerCase().includes('lgbtqia')
}

export interface ClubFilterTarget {
    communityDesignation: string | null
    isCollegiate: boolean
}

/** Does a club pass the given directory filter pill? */
export function clubMatchesFilter(filter: ClubFilterKey, club: ClubFilterTarget): boolean {
    switch (filter) {
        case 'all':
            return true
        case 'collegiate':
            return club.isCollegiate
        case 'bipoc':
            return matchesBipocDesignation(club.communityDesignation)
        case 'lgbtqia':
            return matchesLgbtqiaDesignation(club.communityDesignation)
        default:
            return true
    }
}

/** Per-pill result counts for the full (unfiltered) club list. */
export function getClubFilterCounts(clubs: ClubFilterTarget[]): Record<ClubFilterKey, number> {
    const counts: Record<ClubFilterKey, number> = { all: clubs.length, collegiate: 0, bipoc: 0, lgbtqia: 0 }
    clubs.forEach(club => {
        if (club.isCollegiate) counts.collegiate++
        if (matchesBipocDesignation(club.communityDesignation)) counts.bipoc++
        if (matchesLgbtqiaDesignation(club.communityDesignation)) counts.lgbtqia++
    })
    return counts
}
