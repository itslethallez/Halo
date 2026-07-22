import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f14",
          900: "#111820",
          800: "#1a232e",
          700: "#26323f",
          600: "#3a4a5a",
          200: "#c7ccd1",
          100: "#dfe2e5",
        },
        brand: {
          50: "#f2f7f6",
          100: "#e2ede9",
          200: "#c3dbd3",
          300: "#9cc2b5",
          400: "#6fa393",
          500: "#4d8674",
          600: "#3a6a5c",
          700: "#30544a",
          800: "#28443c",
          900: "#223932",
          950: "#101f1b",
        },
        sand: {
          50: "#faf8f5",
          100: "#f3efe8",
          200: "#e6ddd0",
        },
        alert: {
          500: "#c2542f",
          600: "#a4432a",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
