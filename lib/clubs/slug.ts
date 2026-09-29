/**
 * Shared club slug helpers. The same logic was previously copy-pasted across
 * `app/club/[slug]/page.tsx`, `app/api/club/[slug]/route.ts`,
 * `app/components/Club/ClubMap.tsx`, and the search index generator.
 */

/** Convert a club name to its canonical `/club/[slug]` value. */
export function createClubSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

/**
 * Convert a slug back to an `ilike` pattern for club-name lookup.
 * 2-letter words get wildcards between characters so abbreviations like
 * "W/L" still match ("wl" -> "w%l").
 * Example: "east-coast-gold-wl-team" -> "%east%coast%gold%w%l%team%"
 */
export function buildClubIlikePattern(slug: string): string {
    const words = slug.split('-').filter(w => w.length > 0)
    const processedWords = words.map(word => {
        if (word.length === 2) return word.split('').join('%')
        return word
    })
    return processedWords.join('%')
}
