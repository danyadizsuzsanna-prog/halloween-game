import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Helyben a base '/', GitHub Pages-en a workflow állítja be a repo nevére
// (pl. /halloween-game/) a VITE_BASE_PATH környezeti változón keresztül.
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Éjszakai Rituálé',
        short_name: 'Rituálé',
        description: 'Halloween csapatépítő játék',
        theme_color: '#2b1a3d',
        background_color: '#120c1a',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: { port: 5173 }
})
