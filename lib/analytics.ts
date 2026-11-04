/**
 * Privacy-safe analytics tracking helper for Umami Analytics.
 * Only executes in the browser when window.umami is available.
 */
export function trackEvent(
  eventName: string,
  eventData?: Record<string, string | number | boolean>
): void {
  if (typeof window !== "undefined" && typeof window.umami?.track === "function") {
    // Respect role-based tracking exclusion
    if (localStorage.getItem('umami.disabled') === '1') return;
    try {
      window.umami.track(eventName, eventData);
    } catch {
      // Fail silently if blocked by client content blockers
    }
  }
}

