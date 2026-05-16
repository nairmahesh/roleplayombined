// pitchiq/frontend/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: {
          DEFAULT: '#0A0B0F',
          2: '#111318',
          3: '#181B23',
          4: '#1F2330',
        },
        accent: {
          DEFAULT: '#5B6FFF',
          2: '#7C3AED',
          3: '#06D6A0',
          4: '#FF6B6B',
          5: '#FFD166',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          2: 'rgba(255,255,255,0.12)',
        },
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '16px',
        xl: '20px',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave 1s ease-in-out infinite',
        'speak': 'speak 1.2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease',
        'fade-in': 'fadeIn 0.2s ease',
      },
      keyframes: {
        wave: {
          '0%, 100%': { height: '4px', opacity: '0.4' },
          '50%': { height: '18px', opacity: '1' },
        },
        speak: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.12)', opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
