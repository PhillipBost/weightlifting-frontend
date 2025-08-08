import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WeightliftingDB - USA Weightlifting Results Database",
    template: "%s | WeightliftingDB"
  },
  description: "Search through thousands of competition results and analyze performance trends from USA Weightlifting athletes.",
  keywords: ["weightlifting", "USA weightlifting", "competition results", "athlete database", "olympic weightlifting"],
  authors: [{ name: "WeightliftingDB" }],
  creator: "WeightliftingDB",
  publisher: "WeightliftingDB",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://your-domain.com", // Replace with your actual domain
    siteName: "WeightliftingDB",
    title: "WeightliftingDB - USA Weightlifting Results Database",
    description: "Search through thousands of competition results and analyze performance trends from USA Weightlifting athletes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WeightliftingDB - USA Weightlifting Results Database",
    description: "Search through thousands of competition results and analyze performance trends from USA Weightlifting athletes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}