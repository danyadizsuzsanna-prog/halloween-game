import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { missingEnv } from './lib/supabaseClient'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {missingEnv ? (
      <div style={{ padding: 24, color: '#f2ead9', fontFamily: 'sans-serif' }}>
        Hiányzik a VITE_SUPABASE_URL vagy a VITE_SUPABASE_ANON_KEY. Ellenőrizd a .env fájlt
        (vagy a GitHub Actions secrets beállításait), és indítsd újra / építsd újra.
      </div>
    ) : (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>
)
