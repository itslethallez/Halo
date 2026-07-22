import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        "border-muted": "var(--border-muted)",
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          ink: "var(--accent-ink)",
        },
        "status-safe": "var(--status-safe)",
        hue: {
          bookings: "var(--hue-bookings)",
          safety: "var(--hue-safety)",
          drivers: "var(--hue-drivers)",
          reports: "var(--hue-reports)",
          messages: "var(--hue-messages)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      boxShadow: {
        glow: "var(--halo-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
