/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        'bg-deep': 'var(--color-bg-deep)',
        'bg-base': 'var(--color-bg-base)',
        'bg-elevated': 'var(--color-bg-elevated)',
        'bg-surface': 'var(--color-bg-surface)',
        'amber-300': 'var(--color-amber-300)',
        'amber-400': 'var(--color-amber-400)',
        'amber-500': 'var(--color-amber-500)',
        'amber-600': 'var(--color-amber-600)',
        'copper-400': 'var(--color-copper-400)',
        'copper-500': 'var(--color-copper-500)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        border: 'var(--color-border)',
        'border-subtle': 'var(--color-border-subtle)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
    },
  },
};
