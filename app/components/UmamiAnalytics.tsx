"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import "@/lib/analytics/umami";

export function UmamiAnalytics() {
  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const pathname = usePathname();
  const isScriptLoaded = useRef(false);

  // Track subsequent client-side route changes via Next.js App Router
  useEffect(() => {
    if (!isScriptLoaded.current || !pathname) return;

    if (typeof window !== "undefined" && typeof window.umami?.track === "function") {
      window.umami.track((props) => ({
        ...props,
        url: pathname, // Sends clean pathname without sensitive query params
      }));
    }
  }, [pathname]);

  // Do not inject the script if environment variables are missing (e.g., local dev)
  if (!scriptUrl || !websiteId) {
    return null;
  }

  return (
    <Script
      src={scriptUrl}
      data-website-id={websiteId}
      data-auto-track="false"
      data-domains="owlanalytics.org"
      strategy="afterInteractive"
      onLoad={() => {
        isScriptLoaded.current = true;
        // Record initial page view once the script finishes loading
        if (typeof window !== "undefined" && typeof window.umami?.track === "function") {
          window.umami.track((props) => ({
            ...props,
            url: window.location.pathname,
          }));
        }
      }}
    />
  );
}

