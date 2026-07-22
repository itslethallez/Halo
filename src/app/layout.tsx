import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font (build-time fetch, no runtime request to Google) — the
// Next.js equivalent of the <link>/@import tags called for in the theme file.
// Each font's `variable` name matches what halo-theme.css composes into --font-display/
// --font-sans/--font-mono, so nothing else needs to know these come from next/font.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Halo — Mobile Massage Booking & Safety Platform",
  description: "Secure booking, safety and business management for mobile massage workers and drivers.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0B0E1A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${fraunces.variable} ${hankenGrotesk.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
