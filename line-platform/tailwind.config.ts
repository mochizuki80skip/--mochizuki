import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        line: {
          DEFAULT: "#06C755",
          dark: "#04A047",
          light: "#E8F8EE",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
