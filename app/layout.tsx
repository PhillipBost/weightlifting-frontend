import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./components/AuthProvider";
import { GlobalHeader } from "./components/GlobalHeader";

export const metadata: Metadata = {
  title: {
    template: '%s | OWLanalytics',
    default: 'OWLanalytics',
  },
  description: "Olympic Weightlifting Analytics & Results Database",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {scriptUrl && websiteId && (
          <Script
            src={scriptUrl}
            data-website-id={websiteId}
            data-domains="owlanalytics.org,www.owlanalytics.org"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-screen bg-app-primary text-app-secondary">
        <AuthProvider>
          <ThemeProvider>
            {/* Global header for all non-Home pages, matching /meet */}
            <GlobalHeader />
            {children}
            <Analytics />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
