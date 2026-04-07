/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        airline: {
          blue: '#2C5F8A',
          gold: '#C5A572',
          dark: '#1A3A4F',
          light: '#F0F4F8'
        }
      }
    },
  },
  plugins: [],
}
