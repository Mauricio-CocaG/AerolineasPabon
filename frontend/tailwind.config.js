/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:    '#3960FB',
        penn:       '#142258',
        periwinkle: '#C2CEFE',
        lavender:   '#EBEFFF',
        ink:        '#1A1A2E',
        muted:      '#6B7A99',
        border:     '#E2E8F0',
      },
      fontFamily: {
        sans: ['Urbanist', 'Noto Sans', 'Noto Sans SC', 'Noto Sans KR', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        'card':  '0 2px 16px rgba(57,96,251,0.08), 0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 32px rgba(57,96,251,0.14), 0 2px 8px rgba(0,0,0,0.08)',
        'btn':   '0 4px 14px rgba(57,96,251,0.35)',
        'header':'0 4px 24px rgba(57,96,251,0.18)',
      },
    },
  },
  plugins: [],
}
