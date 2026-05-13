import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // kaloko-inspired palette
        brand: {
          50: '#FFF4F0',
          100: '#FFE4DA',
          200: '#FFC4AF',
          300: '#FFA284',
          400: '#FF7E58',
          500: '#FF5F3D', // primary accent
          600: '#E94527',
          700: '#C0331A',
          800: '#962918',
          900: '#7A2316'
        },
        ink: {
          DEFAULT: '#1A1D21',
          dim: '#5C6470',
          mute: '#8D95A2',
          line: '#E5E7EB'
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F7F7F8',
          tint: '#FFF7F2'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', '"Noto Sans JP"', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.06)',
        fab: '0 8px 24px rgba(255,95,61,0.45)',
        soft: '0 2px 8px rgba(16,24,40,0.08)'
      },
      borderRadius: {
        xl2: '18px'
      },
      maxWidth: {
        screen: '600px'
      }
    }
  },
  plugins: []
};
export default config;
