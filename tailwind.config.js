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
        bw: {
          black: '#000000',
          darkBg: '#09090B',
          darkCard: '#121214',
          darkBorder: '#27272A',
          darkMuted: '#71717A',
          lightBg: '#FAFAFA',
          lightCard: '#FFFFFF',
          lightBorder: '#E4E4E7',
          lightMuted: '#A1A1AA',
        }
      },
      fontFamily: {
        sans: ['"Kantumruy Pro"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        khmer: ['"Kantumruy Pro"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Kantumruy Pro"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
