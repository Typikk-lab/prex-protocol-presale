/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      colors: {
        // Core branding & gamification colors
        'rh-green': '#00C805', 
        'rh-green-dark': '#009904',
        'jackpot-gold': '#FFD700',
        'circuit-red': '#FF4500',
        'dark-bg': '#0A0A0A',
        'dark-surface': '#171717',
      },
      animation: {
        'jackpot-pulse': 'pulseGold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'circuit-flash': 'flashRed 1s ease-in-out infinite',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { opacity: '1', textShadow: '0 0 10px rgba(255, 215, 0, 0.8)' },
          '50%': { opacity: '0.8', textShadow: '0 0 25px rgba(255, 165, 0, 1)' },
        },
        flashRed: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(255, 69, 0, 0.15)' },
        }
      }
    }
  },
  plugins: []
};
