/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        xs: '0.3125rem',
      },
      spacing: {
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [],
};
