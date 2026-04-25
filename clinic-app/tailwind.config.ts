import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0F1115",
          800: "#1A1D23",
          700: "#2A2E36",
          500: "#5B6270",
          400: "#7A8290",
          300: "#A8AEB8",
          200: "#D7DBE0",
          100: "#EEF0F3",
          50:  "#F7F8FA",
        },
        accent: {
          DEFAULT: "#F5C518",
          600: "#E0AE08",
          400: "#FFD84D",
          200: "#FCE89A",
          100: "#FFF6CC",
          50:  "#FFFBE6",
        },
        ok: "#16A34A",
        warn: "#F59E0B",
        ng: "#DC2626",
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-jp)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,17,21,0.04), 0 4px 16px rgba(15,17,21,0.06)",
        glow: "0 0 0 4px rgba(245,197,24,0.18)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
