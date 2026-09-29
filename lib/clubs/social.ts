/**
 * Social link normalization helpers.
 *
 * Club rows store Instagram as `@handles` (e.g. `@abstractbarbell`) while
 * university program rows store full URLs
 * (e.g. `https://www.instagram.com/bronco_lifting/?hl=en`). Everything that
 * renders an Instagram link must pass through `normalizeInstagram()` first.
 */

/** Return a full Instagram URL for either an `@handle`, a bare handle, or a full URL. */
export function normalizeInstagram(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    const handle = trimmed.replace(/^@+/, '')
    if (!handle) return null
    return `https://www.instagram.com/${handle}`
}

/** Ensure an external link has a protocol so `href` behaves predictably. */
export function normalizeExternalUrl(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
}
