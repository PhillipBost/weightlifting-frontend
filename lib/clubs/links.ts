/**
 * Canonical USA Weightlifting pages that club specialty badges deep-link to.
 *
 * Both URLs were verified live before being hardcoded (the `/navigation/...`
 * path IS the canonical one for University Programs; the shorter
 * `/university-programs` and `/club-wso/university-programs` variants 404):
 * - BIPOC/LGBTQIA+ clubs -> `/club-wso/bipoc-lgbtqia-clubs`, the source
 *   directory backing `community_designation`. Its table matches our 23
 *   designated clubs one-for-one, verbatim.
 * - University Programs  -> `/navigation/clubs/university-programs`, the
 *   collegiate landing page linked from the site's Clubs nav.
 */

/** USAW directory of BIPOC- and LGBTQIA+-owned/friendly clubs. */
export const USAW_BIPOC_LGBTQIA_CLUBS_URL =
    'https://www.usaweightlifting.org/club-wso/bipoc-lgbtqia-clubs'

/** USAW University Programs landing page (collegiate clubs). */
export const USAW_UNIVERSITY_PROGRAMS_URL =
    'https://www.usaweightlifting.org/navigation/clubs/university-programs'

/**
 * USAW club finder (Sport80 widget) backing the header's
 * "USAW Club Directory" shortcut.
 */
export const USAW_CLUB_DIRECTORY_URL =
    'https://usaweightlifting.sport80.com/public/widget/7'
