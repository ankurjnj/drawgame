/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#0a0a0f',
        'purple': '#7B2FFF',
        'purple-light': '#9B5FFF',
        'purple-dark': '#5B0FDF',
      },
      fontFamily: {
        'rajdhani': ['Rajdhani', 'sans-serif'],
        'caveat': ['Caveat', 'cursive'],
      }
    },
  },
  plugins: [],
}
