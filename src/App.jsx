import { useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useSession } from './lib/useSession'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login.jsx'
import Lobby from './pages/Lobby.jsx'
import Task from './pages/Task.jsx'
import Inventory from './pages/Inventory.jsx'
import RitualSubmit from './pages/RitualSubmit.jsx'
import Presenter from './pages/Presenter.jsx'
import Scan from './pages/Scan.jsx'
import NameScreen from './pages/NameScreen.jsx'
import WaitingRoom from './pages/WaitingRoom.jsx'
import StaffHome from './pages/StaffHome.jsx'
import PinScreen from './pages/PinScreen.jsx'

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-ritual-black">
      <p className="text-ritual-orange font-display text-lg animate-pulse">
        A boszorkányok készülődnek…
      </p>
    </div>
  )
}

const PIN_SKIP_KEY = 'ritual_pin_skipped'
function readPinSkipped() {
  try {
    return localStorage.getItem(PIN_SKIP_KEY) === '1'
  } catch {
    return false
  }
}

function PinChangePage() {
  const navigate = useNavigate()
  return <PinScreen mode="change" onDone={() => navigate('/lobby')} onSkip={() => navigate('/lobby')} />
}

export default function App() {
  const { session, profile, loading, refreshProfile } = useSession()
  // A PIN beállítása belépés után egyszer felajánlott (kihagyható) lépés.
  const [pinHandled, setPinHandled] = useState(readPinSkipped)

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

  // Első belépéskor mindenki megadja a nevét (email címet a játék sehol nem mutat).
  if (!profile.display_name) {
    return <NameScreen onDone={refreshProfile} />
  }

  // Saját PIN: belépés után egyszer felajánljuk (kihagyható).
  const pinSet = !!session.user?.user_metadata?.pin_set
  if (!pinSet && !pinHandled) {
    return (
      <PinScreen
        mode="setup"
        onDone={() => setPinHandled(true)}
        onSkip={() => {
          try {
            localStorage.setItem(PIN_SKIP_KEY, '1')
          } catch {
            /* nem baj */
          }
          setPinHandled(true)
        }}
      />
    )
  }

  // A játékoshoz kötött oldalak csak csapattal érhetők el; csapat nélkül
  // (várakozó szoba) a /lobby minden más útvonalat átvesz.
  const hasTeam = !!profile.team_id
  const gated = (el) => (hasTeam ? el : <Navigate to="/lobby" replace />)

  // /lobby: stáb → beosztás-vezérlő; csapat nélküli játékos → várakozó szoba;
  // csapattag → a csapat lobbyja.
  const home = profile.is_staff ? (
    <StaffHome profile={profile} />
  ) : hasTeam ? (
    <Lobby profile={profile} refreshProfile={refreshProfile} />
  ) : (
    <WaitingRoom profile={profile} refreshProfile={refreshProfile} />
  )

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="/lobby" element={home} />
      <Route path="/pin" element={<PinChangePage />} />
      <Route path="/scan" element={gated(<Scan />)} />
      <Route path="/task/:stationId" element={gated(<Task profile={profile} />)} />
      <Route path="/inventory" element={gated(<Inventory profile={profile} />)} />
      <Route path="/ritual" element={gated(<RitualSubmit profile={profile} />)} />
      {/* A stáb bejelentkezve, is_staff=true profillal éri el — ezt kézzel
          kell beállítani az adatbázisban a stáb tagjainak az esemény előtt. */}
      <Route path="/presenter" element={<Presenter profile={profile} />} />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  )
}
