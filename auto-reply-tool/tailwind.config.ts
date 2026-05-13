import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf6f0",
          100: "#fae7d6",
          500: "#d97947",
          600: "#bf5f2d",
          700: "#9a4a23",
        },
      },
    },
  },
  plugins: [],
};

export default config;
