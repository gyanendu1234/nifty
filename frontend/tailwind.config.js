/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        largecap: {
          bg:   '#dcfce7',
          text: '#15803d',
          border: '#86efac',
        },
        midcap: {
          bg:   '#fef9c3',
          text: '#a16207',
          border: '#fde047',
        },
        smallcap: {
          bg:   '#f3e8ff',
          text: '#7e22ce',
          border: '#d8b4fe',
        },
        up: {
          bg:   '#dcfce7',
          text: '#16a34a',
        },
        down: {
          bg:   '#fee2e2',
          text: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
