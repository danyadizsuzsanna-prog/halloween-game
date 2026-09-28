/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Creative Director approved palette: misztikus, rejtélyes, NEM horror
        ritual: {
          purple: '#3d2159',
          purpleDark: '#221231',
          orange: '#d9772f',
          red: '#8c2f39',
          black: '#17111f',
          gray: '#5b5560',
          bone: '#f2ead9'
        },
        monster: {
          vampire: '#8c2f39',
          ghost: '#7d8ca3',
          werewolf: '#3f4d33'
        }
      },
      fontFamily: {
        display: ['"Cinzel Decorative"', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
