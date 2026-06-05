export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:    '#0F2557',
          saffron: '#F5821E',
          green:   '#065F46',
        },
        primary: { DEFAULT: '#065F46', dark: '#044434' },
        accent:  { DEFAULT: '#F5821E', dark: '#d96c0a' },
        danger:  { DEFAULT: '#CC1414', dark: '#b01010' },
        success: { DEFAULT: '#16A34A', dark: '#15803d' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl:  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(6,95,70,0.06)',
        'card-lg': '0 4px 16px rgba(6,95,70,0.12)',
      },
    },
  },
  plugins: [],
}
