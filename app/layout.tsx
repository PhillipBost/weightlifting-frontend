import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./components/AuthProvider";
import { GlobalHeader } from "./components/GlobalHeader";

export const metadata: Metadata = {
  title: "WeightliftingDB",
  description: "USA Weightlifting Results Database",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
