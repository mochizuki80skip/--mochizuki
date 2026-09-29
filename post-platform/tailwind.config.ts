import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1a73e8",
          dark: "#1557b0",
          light: "#e8f0fe",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
