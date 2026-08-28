/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      colors: {
        brand: '#2563eb',
        ink:   '#111111',
        muted: '#888888',
        soft:  '#f4f4f4',
        line:  '#f0f0f0',
      },
      letterSpacing: { tight: '-0.03em', tighter: '-0.04em' },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
