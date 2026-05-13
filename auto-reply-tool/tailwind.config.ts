import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf6f0",
          100: "#fae7d6",
          200: "#f3cba4",
          300: "#eba572",
          400: "#e08043",
          500: "#d97947",
          600: "#bf5f2d",
          700: "#9a4a23",
          800: "#73371a",
          900: "#4f2412",
        },
        ink: {
          900: "#1f1a17",
          800: "#2a231e",
          700: "#3a322c",
          600: "#5a4f47",
        },
      },
    },
  },
  plugins: [],
};

export default config;
