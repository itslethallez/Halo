import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrueReach — Mobile Massage Booking & Safety Platform",
  description: "Secure booking, safety and business management for mobile massage workers and drivers.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#223932",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
