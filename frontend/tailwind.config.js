/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          dark: '#0f1117',
          card: '#1a1d2e',
          'card-hover': '#23273e',
          border: '#2a2f45',
          light: '#f8f9fa',
          'light-card': '#ffffff',
          'light-border': '#e2e8f0',
        },
        scientific: {
          blue: '#0284c7',
          cyan: '#06b6d4',
          accent: '#38bdf8',
          teal: '#14b8a6',
        },
        status: {
          ok: '#10b981',       // Green
          warning: '#f59e0b',  // Amber
          critical: '#ef4444', // Red
          info: '#3b82f6',     // Blue
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
