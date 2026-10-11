/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0, 0, 0, 0.08)',
      },
      colors: {
        dark: {
          bg: '#0B0B0B',
          surface: '#161616',
          text: '#F5F5F5',
          border: '#333333',
          muted: '#A8A8A8',
          warning: '#FF8A7A',
        },
        light: {
          bg: '#FFFFFF',
          text: '#111111',
          border: '#D9D9D9',
          muted: '#5F5F5F',
          warning: '#B3261E',
        },
      },
    },
  },
  plugins: [],
}
