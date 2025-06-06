/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          '50': '#f3e5f5',
          '100': '#e1bee7',
          '200': '#ce93d8',
          '300': '#ba68c8',
          '400': '#ab47bc',
          '500': '#9c27b0',
          '600': '#8e24aa',
          '700': '#7b1fa2',
          '800': '#6a1b9a',
          '900': '#4a148c',
        },
        // Add other Materialize-like colors here
      },
    },
  },
  plugins: [],
}