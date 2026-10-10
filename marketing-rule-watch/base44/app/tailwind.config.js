/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Vigil palette, from brand/tailwind.vigil.js
        night: { 950: '#0B1120', 900: '#131B2E', 800: '#1A2338', 700: '#2A3550', 600: '#4A5570', 400: '#6E7A96', 300: '#8B95AE', 200: '#C9CFDC' },
        paper: { 50: '#FAF8F4', 100: '#F3EFE7', 200: '#E6E0D4' },
        lamp: { 100: '#FFF1D6', 300: '#FFCF6E', 500: '#F5A524', 700: '#9A5B00' },
        ember: { 100: '#FBE3DE', 600: '#B8382A', 700: '#962C20' },
        dusk: { 100: '#E3EAF5', 500: '#5878AD', 700: '#34558A' },
        sage: { 100: '#DDF0E6', 500: '#3B9A6F', 700: '#22674A' },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
    },
  },
  plugins: [],
};
