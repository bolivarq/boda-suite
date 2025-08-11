/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fefdf8',
          100: '#fef7e0',
          200: '#fdecc4',
          300: '#fbd89a',
          400: '#f7c065',
          500: '#f3a73b',
          600: '#e4901f',
          700: '#bd7518',
          800: '#985d1a',
          900: '#7c4d19',
        },
        beige: {
          50: '#faf9f7',
          100: '#f2f0eb',
          200: '#e6e1d7',
          300: '#d6cdb9',
          400: '#c4b59a',
          500: '#b5a082',
          600: '#a08c73',
          700: '#857460',
          800: '#6d5f51',
          900: '#594f43',
        }
      }
    },
  },
  plugins: [],
}