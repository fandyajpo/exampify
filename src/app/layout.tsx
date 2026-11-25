import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { PageTransition } from "@/components/motion/page-transition";
import { publicEnv } from "@/lib/env";
import "./globals.css";

/*
 * Typography per DESIGN_SYSTEM.md §4.1. The interface runs on the platform's own face
 * (`system-ui`), which ships optical sizing, tracking tables and legibility tuning for free.
 * Only the editorial serif and the mono face are self-hosted with next/font — no Google CDN
 * request at runtime.
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for canonical and OG tags (SEO_AND_CONTENT_STRATEGY.md §3.2).
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  // Homepage title formula (SEO_AND_CONTENT_STRATEGY.md §3.2).
  title: {
    default: "Exampify — Study notes, lessons & practice questions",
    template: "%s | Exampify",
  },
  description:
    "Practice, revision and mock exams for exam candidates, with study material, lessons with practice and timed practice tests.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
