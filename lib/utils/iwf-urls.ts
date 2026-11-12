/**
 * International Weightlifting Federation (IWF) Official URL Resolution Utility
 *
 * Implements the official 4-tier chronological meet results URL routing standard on iwf.sport:
 * 1. August 2026 – Current:   https://iwf.sport/results/results-by-events/?event_id=${eventId}
 * 2. July 2025 – July 2026:   https://iwf.sport/results/results-by-events/results-by-events-2025-2026/?event_id=${eventId}
 * 3. Nov 2018 – May 2025:     https://iwf.sport/results/results-by-events/results-by-events-2018-2025/?event_id=${eventId}
 * 4. 1998 – Oct 2018:         https://iwf.sport/results/results-by-events/results-by-events-upto2018/?event_id=${eventId}
 */

export interface IwfDateComponents {
  year: number | null;
  month: number | null; // 1-12
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parses date or year input into year and month components without timezone skew.
 */
export function parseIwfDate(dateOrYear?: string | number | Date | null): IwfDateComponents {
  if (dateOrYear === null || dateOrYear === undefined || dateOrYear === '') {
    return { year: null, month: null };
  }

  if (typeof dateOrYear === 'number') {
    return { year: isNaN(dateOrYear) ? null : dateOrYear, month: null };
  }

  if (dateOrYear instanceof Date) {
    if (isNaN(dateOrYear.getTime())) return { year: null, month: null };
    return {
      year: dateOrYear.getFullYear(),
      month: dateOrYear.getMonth() + 1
    };
  }

  const str = String(dateOrYear).trim();

  // 1. ISO format: 2026-07-23 or 2026-07
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10)
    };
  }

  // 2. Textual month + year: "Jul 23, 2026", "23 Jul 2026", "July 2026"
  const monthNameMatch = str.match(/\b([A-Za-z]+)\b.*?\b(\d{4})\b/) || str.match(/\b(\d{4})\b.*?\b([A-Za-z]+)\b/);
  if (monthNameMatch) {
    const word = (isNaN(Number(monthNameMatch[1])) ? monthNameMatch[1] : monthNameMatch[2]).toLowerCase();
    const yearVal = parseInt(!isNaN(Number(monthNameMatch[1])) ? monthNameMatch[1] : monthNameMatch[2], 10);
    const monthVal = MONTH_MAP[word] || null;
    if (monthVal) {
      return { year: yearVal, month: monthVal };
    }
  }

  // 3. 4-digit year fallback
  const yearMatch = str.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return { year: parseInt(yearMatch[0], 10), month: null };
  }

  // 4. Date constructor fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1
    };
  }

  return { year: null, month: null };
}

/**
 * Returns the era path slug according to the 4-tier chronological standard.
 */
export function getIwfEraSlug(dateOrYear?: string | number | Date | null): string {
  const { year, month } = parseIwfDate(dateOrYear);

  if (!year) {
    return '';
  }

  // 1. August 2026 – Current
  if (year > 2026) {
    return '';
  }
  if (year === 2026 && month !== null && month >= 8) {
    return '';
  }

  // 2. July 2025 – July 2026
  if (year === 2026) {
    // When month is <= 7 or unspecified, 2026 belongs to the 2025-2026 era
    return 'results-by-events-2025-2026/';
  }
  if (year === 2025 && (month === null || month >= 7)) {
    return 'results-by-events-2025-2026/';
  }

  // 3. Nov 2018 – May 2025
  if (year === 2025 && month !== null && month <= 6) {
    return 'results-by-events-2018-2025/';
  }
  if (year >= 2019 && year <= 2024) {
    return 'results-by-events-2018-2025/';
  }
  if (year === 2018 && month !== null && month >= 11) {
    return 'results-by-events-2018-2025/';
  }

  // 4. 1998 – Oct 2018
  if (year === 2018) {
    // Month is <= 10 or unspecified (Jan–Oct 2018)
    return 'results-by-events-upto2018/';
  }
  if (year <= 2017) {
    return 'results-by-events-upto2018/';
  }

  return '';
}

/**
 * Extracts a clean numeric event ID from a string, number, or full IWF URL.
 */
export function extractIwfEventId(input?: string | number | null): string | null {
  if (!input) return null;
  const str = String(input).trim();
  const urlMatch = str.match(/[?&]event_id=(\d+)/i);
  if (urlMatch) return urlMatch[1];
  const digits = str.match(/^\d+$/);
  if (digits) return digits[0];
  const trailingDigits = str.match(/(\d+)\/?$/);
  if (trailingDigits) return trailingDigits[1];
  return str;
}

/**
 * Detects the year context when a user pastes a full official IWF URL.
 */
export function detectYearFromIwfUrl(url: string): number | null {
  if (!url) return null;
  if (url.includes('results-by-events-upto2018')) return 2018;
  if (url.includes('results-by-events-2018-2025')) return 2024;
  if (url.includes('results-by-events-2025-2026')) return 2026;
  if (url.includes('results-by-events')) return new Date().getFullYear();
  return null;
}

/**
 * Generates the official IWF meet results URL compliant with the 4-tier chronological standard.
 */
export function getOfficialIwfMeetUrl(
  eventId?: string | number | null,
  dateOrYear?: string | number | Date | null
): string | null {
  const cleanId = extractIwfEventId(eventId);
  if (!cleanId) return null;

  const eraSlug = getIwfEraSlug(dateOrYear);
  return `https://iwf.sport/results/results-by-events/${eraSlug}?event_id=${cleanId}`;
}

