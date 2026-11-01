type UmamiPayload = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (
        eventNameOrMapper?:
          | string
          | ((defaultProps: Record<string, unknown>) => Record<string, unknown>),
        eventData?: UmamiPayload
      ) => void;
    };
  }
}

/**
 * Allowed privacy-safe custom events for OWLanalytics.
 * Restricts payloads strictly to non-PII categorical dimensions.
 */
export type AnalyticsEventMap = {
  athlete_lookup: {
    source: "USAW" | "IWF" | "OWLCMS";
    search_variant: "hero" | "header";
  };
  meet_lookup: {
    source: "USAW" | "IWF" | "OWLCMS";
    search_variant: "hero" | "header";
  };
  entity_lookup: {
    category: "club" | "university" | "wso";
    search_variant: "hero" | "header";
  };
  data_export: {
    format: "csv" | "json";
    dataset_scope: "athlete_history" | "meet_results" | "archive_table";
  };
};

export function trackUmamiEvent<K extends keyof AnalyticsEventMap>(
  eventName: K,
  eventData: AnalyticsEventMap[K]
): void {
  if (typeof window === "undefined") return;

  try {
    if (typeof window.umami?.track === "function") {
      window.umami.track(eventName, eventData);
    }
  } catch {
    // Fail silently if blocked by client content blockers
  }
}

