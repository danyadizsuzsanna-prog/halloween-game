import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const ALL_INGREDIENTS = [
  'Boszorkánygyökér',
  'Ezüstpor',
  'Obszidiánszilánk',
  'Szellembogyó',
  'Árnyékgomba',
  'Hollókönny'
]

export default function Inventory({ profile }) {
  const navigate = useNavigate()
  const [owned, setOwned] = useState(new Set())

  useEffect(() => {
    async function load() {
      // Csak a "van-e" infó jelenik meg — az állapot (friss/romló/tiszta/
      // fertőzött) SOSE látszik itt, a rejtély a rituáléig megmarad.
      const { data } = await supabase
        .from('team_inventory')
        .select('ingredients(name)')
        .eq('team_id', profile.team_id)
      const names = new Set((data ?? []).map((row) => row.ingredients.name))
      setOwned(names)
    }
    load()
  }, [profile.team_id])

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <h1 className="font-display text-2xl text-ritual-orange mb-6">Alapanyagok</h1>

      <div className="grid grid-cols-2 gap-3">
        {ALL_INGREDIENTS.map((name) => {
          const has = owned.has(name)
          return (
            <div
              key={name}
              className={`rounded-xl px-4 py-5 text-center border ${
                has
                  ? 'bg-ritual-purpleDark border-ritual-orange text-ritual-bone'
                  : 'bg-transparent border-ritual-purple text-ritual-gray'
              }`}
            >
              <div className="text-2xl mb-1">{has ? '🧪' : '❔'}</div>
              <div className="text-sm">{name}</div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => navigate('/lobby')}
        className="w-full mt-8 rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
      >
        Vissza
      </button>
    </div>
  )
}
