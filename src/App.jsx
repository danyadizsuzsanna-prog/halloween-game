import { Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './lib/useSession'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login.jsx'
import Lobby from './pages/Lobby.jsx'
import Task from './pages/Task.jsx'
import Inventory from './pages/Inventory.jsx'
import RitualSubmit from './pages/RitualSubmit.jsx'
import Presenter from './pages/Presenter.jsx'
import Scan from './pages/Scan.jsx'

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-ritual-black">
      <p className="text-ritual-orange font-display text-lg animate-pulse">
        A boszorkányok készülődnek…
      </p>
    </div>
  )
}

export default function App() {
  const { session, profile, loading, refreshProfile } = useSession()

  if (loading) return <LoadingScreen />

  if (session && !profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center">
        <div>
          <p className="text-ritual-bone mb-4">
            A profilod nem tölthető be. Próbáld újra, vagy szólj a szervezőknek.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
          >
            Kijelentkezés
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="/lobby" element={<Lobby profile={profile} refreshProfile={refreshProfile} />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/task/:stationId" element={<Task profile={profile} />} />
      <Route path="/inventory" element={<Inventory profile={profile} />} />
      <Route path="/ritual" element={<RitualSubmit profile={profile} />} />
      {/* A stáb bejelentkezve, is_staff=true profillal éri el — ezt kézzel
          kell beállítani az adatbázisban a stáb tagjainak az esemény előtt. */}
      <Route path="/presenter" element={<Presenter profile={profile} />} />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  )
}
