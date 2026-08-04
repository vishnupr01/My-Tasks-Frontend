import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // --theme-font (globals.css) points at JetBrains Mono for the hacker
        // theme and a plain sans-serif stack for normal/dark -- own variable,
        // not Next's --font-mono directly, so there's no cascade-order fight
        // with the font loader's own generated CSS.
        mono: ['var(--theme-font)'],
      },
      colors: {
        // Backed by CSS variables (see globals.css) so [data-theme] swaps every
        // bg-black / text-green-400 / border-green-900 class app-wide with no
        // component changes. rgb(var(...) / <alpha-value>) is Tailwind's documented
        // pattern for keeping opacity modifiers (bg-green-900/40) working with themeable colors.
        black: 'rgb(var(--c-black) / <alpha-value>)',
        green: {
          200: 'rgb(var(--c-green-200) / <alpha-value>)',
          300: 'rgb(var(--c-green-300) / <alpha-value>)',
          400: 'rgb(var(--c-green-400) / <alpha-value>)',
          500: 'rgb(var(--c-green-500) / <alpha-value>)',
          600: 'rgb(var(--c-green-600) / <alpha-value>)',
          700: 'rgb(var(--c-green-700) / <alpha-value>)',
          800: 'rgb(var(--c-green-800) / <alpha-value>)',
          900: 'rgb(var(--c-green-900) / <alpha-value>)',
          950: 'rgb(var(--c-green-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
