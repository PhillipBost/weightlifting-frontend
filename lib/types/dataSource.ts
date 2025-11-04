/**
 * Data Source Type System
 *
 * Unified type definitions and utilities for distinguishing between
 * USAW (USA Weightlifting) and IWF (International Weightlifting Federation) data
 */

// ============================================================================
// Core Type Definitions
// ============================================================================

/**
 * Identifies the source database for any piece of data
 */
export type DataSource = 'USAW' | 'IWF'

/**
 * Interface for any data that has a source identifier
 */
export interface DataWithSource {
  source: DataSource
}

/**
 * Athlete/Lifter data with source identifier
 */
export interface AthleteWithSource extends DataWithSource {
  id: number | string
  name: string
  gender?: 'M' | 'F'
  birthYear?: number
  country?: string
}

/**
 * Meet/Competition data with source identifier
 */
export interface MeetWithSource extends DataWithSource {
  id: number | string
  name: string
  date: string
  level?: string
  location?: string
}

/**
 * Search result union type for athletes from either source
 */
export type AthleteSearchResult = AthleteWithSource & {
  membershipNumber?: string
  club?: string
  wso?: string
}

/**
 * Search result union type for meets from either source
 */
export type MeetSearchResult = MeetWithSource & {
  address?: string
  city?: string
  state?: string
}

// ============================================================================
// Type Guard Functions
// ============================================================================

/**
 * Type guard to check if data source is USAW
 */
export function isUSAW(source: DataSource | unknown): source is 'USAW' {
  return source === 'USAW'
}

/**
 * Type guard to check if data source is IWF
 */
export function isIWF(source: DataSource | unknown): source is 'IWF' {
  return source === 'IWF'
}

/**
 * Type guard for data with source
 */
export function hasSource(data: unknown): data is DataWithSource {
  return (
    typeof data === 'object' &&
    data !== null &&
    'source' in data &&
    (data.source === 'USAW' || data.source === 'IWF')
  )
}

// ============================================================================
// UI Utility Functions
// ============================================================================

/**
 * Get human-readable label for a data source
 */
export function getSourceLabel(source: DataSource): string {
  return source === 'USAW'
    ? 'USA Weightlifting'
    : 'International (IWF)'
}

/**
 * Get badge/chip text for displaying source in UI
 */
export function getSourceBadge(source: DataSource): string {
  return source === 'USAW' ? 'USAW' : 'IWF'
}

/**
 * Get badge color for styling source indicator
 * Returns Tailwind CSS color classes
 */
export function getSourceColor(source: DataSource): {
  bg: string
  text: string
  border: string
} {
  return source === 'USAW'
    ? {
        bg: 'bg-blue-100 dark:bg-blue-950',
        text: 'text-blue-800 dark:text-blue-200',
        border: 'border-blue-300 dark:border-blue-700'
      }
    : {
        bg: 'bg-green-100 dark:bg-green-950',
        text: 'text-green-800 dark:text-green-200',
        border: 'border-green-300 dark:border-green-700'
      }
}

/**
 * Get a full Tailwind CSS class string for source badge styling
 */
export function getSourceBadgeClasses(source: DataSource): string {
  const colors = getSourceColor(source)
  return `px-2 py-1 rounded text-sm font-medium border ${colors.bg} ${colors.text} ${colors.border}`
}

// ============================================================================
// URL Builder Functions
// ============================================================================

/**
 * Build athlete profile URL based on source
 * USAW: /athlete/[id]
 * IWF: /athlete/iwf-[id]
 */
export function buildAthleteUrl(id: number | string, source: DataSource): string {
  if (isIWF(source)) {
    return `/athlete/iwf-${id}`
  }
  return `/athlete/${id}`
}

/**
 * Build meet results page URL based on source
 * USAW: /meet/[id]
 * IWF: /meet/iwf-[id]
 */
export function buildMeetUrl(id: number | string, source: DataSource): string {
  if (isIWF(source)) {
    return `/meet/iwf-${id}`
  }
  return `/meet/${id}`
}

/**
 * Extract source from URL path
 * Returns 'IWF' if path contains 'iwf-', otherwise 'USAW'
 */
export function extractSourceFromPath(path: string): DataSource {
  return path.includes('iwf-') ? 'IWF' : 'USAW'
}

/**
 * Extract ID from athlete URL parameter
 * Handles both /athlete/[id] and /athlete/iwf-[id] formats
 */
export function extractAthleteIdFromParam(param: string): {
  id: string | number
  source: DataSource
} {
  if (param.startsWith('iwf-')) {
    return {
      id: param.slice(4), // Remove 'iwf-' prefix
      source: 'IWF'
    }
  }
  return {
    id: param,
    source: 'USAW'
  }
}

/**
 * Extract ID from meet URL parameter
 * Handles both /meet/[id] and /meet/iwf-[id] formats
 */
export function extractMeetIdFromParam(param: string): {
  id: string | number
  source: DataSource
} {
  if (param.startsWith('iwf-')) {
    return {
      id: param.slice(4), // Remove 'iwf-' prefix
      source: 'IWF'
    }
  }
  return {
    id: param,
    source: 'USAW'
  }
}

// ============================================================================
// Sorting and Comparison Functions
// ============================================================================

/**
 * Sort search results by source (USAW first, then IWF)
 * and within each source by match quality
 */
export function sortSearchResultsBySource<T extends DataWithSource>(
  results: T[],
  compareBy?: (a: T, b: T) => number
): T[] {
  return [...results].sort((a, b) => {
    // USAW first
    if (isUSAW(a.source) && isIWF(b.source)) return -1
    if (isIWF(a.source) && isUSAW(b.source)) return 1

    // Within same source, use provided comparator if available
    if (compareBy) {
      return compareBy(a, b)
    }

    return 0
  })
}

/**
 * Deduplicate search results by ID within each source
 * Keeps first occurrence of each unique (id, source) pair
 */
export function deduplicateBySource<T extends DataWithSource & { id: string | number }>(
  results: T[]
): T[] {
  const seen = new Set<string>()

  return results.filter((item) => {
    const key = `${item.source}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Create a data object with source annotation
 */
export function withSource<T>(data: T, source: DataSource): T & DataWithSource {
  return {
    ...data,
    source
  }
}

/**
 * Remove source annotation from data object
 */
export function removeSource<T extends DataWithSource>(
  data: T
): Omit<T, 'source'> {
  const { source, ...rest } = data
  return rest
}
