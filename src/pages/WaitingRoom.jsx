import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { imgUrl } from '../lib/images'

// Várakozó szoba: amíg a stáb el nem indítja a csapatbeosztást, itt vár mindenki.
// A profil időnként újratöltődik, és amint csapatot kap a játékos, az App
// automatikusan átvált a Lobbyra.
export default function WaitingRoom({ profile, refreshProfile }) {
  const [room, setRoom] = useState({ count: 0, players: [] })

  useEffect(() => {
    let alive = true
    async function tick() {
      const { data } = await supabase.rpc('get_waiting_room')
      if (alive && data) setRoom(data)
      await refreshProfile()
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => {
      alive = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-8 safe-top safe-bottom flex flex-col items-center">
      <img
        src={imgUrl('uszt')}
        alt=""
        className="w-28 h-28 object-contain rs-float mb-3 mt-2"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      <h1 className="font-display text-2xl text-ritual-orange text-center mb-1">Várakozó szoba</h1>
      <p className="text-ritual-bone text-center mb-1">Szia, {profile.display_name}!</p>
      <p className="text-ritual-gray text-sm text-center max-w-sm mb-6">
        A szervezők hamarosan beosztják a csapatokat. Maradj itt — ez az oldal magától továbblép,
        amint megvan a csapatod.
      </p>

      <div className="w-full max-w-sm bg-ritual-purpleDark border border-ritual-purple rounded-2xl p-4">
        <p className="text-ritual-gray text-xs uppercase tracking-wide mb-3">
          Már itt vannak ({room.count} fő)
        </p>
        <div className="flex flex-wrap gap-2">
          {room.players.map((n, i) => (
            <span
              key={`${n}-${i}`}
              className={`rounded-full px-3 py-1 text-sm ${
                n === profile.display_name
                  ? 'bg-ritual-orange text-ritual-black font-semibold'
                  : 'bg-ritual-black/60 text-ritual-bone'
              }`}
            >
              {n}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-10 text-ritual-gray text-xs underline"
      >
        Kijelentkezés
      </button>
    </div>
  )
}
