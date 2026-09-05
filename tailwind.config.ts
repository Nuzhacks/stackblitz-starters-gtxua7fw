import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0b0e11',
          800: '#12161b',
          700: '#171c22',
          600: '#1e242b',
          500: '#2b3138',
        },
        gain: '#4ade80',
        loss: '#f87171',
      },
    },
  },
  plugins: [],
};
export default config;
