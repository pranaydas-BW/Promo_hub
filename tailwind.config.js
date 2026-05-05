/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: '#0D0D0D',
        paper: '#F5F2EC',
        accent: '#E8490F',
        muted: '#8C8880',
        border: '#E2DDD6',
        success: '#1A7A4A',
        warning: '#C97D10',
        danger: '#C0392B',
        info: '#1D4ED8',
      },
    },
  },
  plugins: [],
}
