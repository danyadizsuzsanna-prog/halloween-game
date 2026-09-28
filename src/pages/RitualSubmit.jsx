import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RitualSubmit({ profile }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState({}) // ingredient_id -> inventory row id
  const [config, setConfig] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('team_inventory')
        .select('id, acquired_at, ingredients(id, name), team_station_attempts(stations(room_name))')
        .eq('team_id', profile.team_id)
        .order('acquired_at', { ascending: true })
      setRows(data ?? [])

      const { data: cfg } = await supabase.from('game_config').select('*').single()
      setConfig(cfg)

      // alapértelmezésben az elsőként megszerzett példányt jelöljük ki
      const defaults = {}
      ;(data ?? []).forEach((r) => {
        if (!defaults[r.ingredients.id]) defaults[r.ingredients.id] = r.id
      })
      setSelected(defaults)
    }
    load()
  }, [profile.team_id])

  const grouped = useMemo(() => {
    const map = {}
    rows.forEach((r) => {
      const key = r.ingredients.id
      if (!map[key]) map[key] = { name: r.ingredients.name, options: [] }
      map[key].options.push(r)
    })
    return map
  }, [rows])

  const missingCount = 6 - Object.keys(grouped).length

  async function handleSubmit() {
    if (!confirm('Biztosan beküldöd a rituálét? Utána nem módosítható.')) return
    setSubmitting(true)
    const ids = Object.values(selected)
    const { error } = await supabase.rpc('submit_ritual', {
      p_inventory_ids: ids,
      p_deadline: config?.ends_at
    })
    setSubmitting(false)
    if (error) {
      alert(error.message)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center">
        <p className="font-display text-2xl text-ritual-orange mb-3">
          A rituálé elindult…
        </p>
        <p className="text-ritual-gray">
          Nézzétek a nagy kivetítőt — hamarosan sorra kerültök!
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <h1 className="font-display text-2xl text-ritual-orange mb-2">A rituálé összeállítása</h1>
      {missingCount > 0 && (
        <p className="text-monster-vampire text-sm mb-4">
          {missingCount} alapanyag még hiányzik — beküldhető, de hiányos rituálé lesz belőle.
        </p>
      )}

      <div className="space-y-4 mb-8">
        {Object.entries(grouped).map(([ingredientId, group]) => (
          <div key={ingredientId} className="bg-ritual-purpleDark rounded-xl p-4">
            <p className="font-semibold text-ritual-bone mb-2">{group.name}</p>
            {group.options.length === 1 ? (
              <p className="text-ritual-gray text-sm">Egy példányotok van — ez kerül be.</p>
            ) : (
              <div className="flex gap-2">
                {group.options.map((opt, i) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setSelected((s) => ({ ...s, [ingredientId]: opt.id }))
                    }
                    className={`flex-1 rounded-lg px-3 py-2 text-sm border ${
                      selected[ingredientId] === opt.id
                        ? 'border-ritual-orange text-ritual-orange'
                        : 'border-ritual-purple text-ritual-gray'
                    }`}
                  >
                    {i + 1}. próbálkozás ({opt.team_station_attempts.stations.room_name})
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || rows.length === 0}
        className="w-full rounded-xl px-4 py-4 bg-ritual-red text-ritual-bone font-semibold disabled:opacity-50"
      >
        {submitting ? 'Küldés…' : 'Rituálé beküldése'}
      </button>
      <button
        onClick={() => navigate('/lobby')}
        className="w-full mt-3 rounded-xl px-4 py-3 bg-transparent border border-ritual-purple text-ritual-gray"
      >
        Mégse, vissza
      </button>
    </div>
  )
}
