import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function RitualSubmit({ profile }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState({}) // ingredient_id -> inventory row id
  const [config, setConfig] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [, setTick] = useState(0)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_my_inventory')
      setRows(data ?? [])
      const { data: cfg } = await supabase.from('game_config').select('*').single()
      setConfig(cfg)
      // alapértelmezésben az elsőként megszerzett példányt jelöljük ki
      const defaults = {}
      ;(data ?? []).forEach((r) => {
        if (!defaults[r.ingredient_id]) defaults[r.ingredient_id] = r.id
      })
      setSelected(defaults)
    }
    load()
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const grouped = useMemo(() => {
    const map = {}
    rows.forEach((r) => {
      if (!map[r.ingredient_id]) map[r.ingredient_id] = { name: r.ingredient_name, options: [] }
      map[r.ingredient_id].options.push(r)
    })
    return map
  }, [rows])

  const missingCount = 6 - Object.keys(grouped).length
  const deadline = config?.ritual_deadline ? new Date(config.ritual_deadline).getTime() : null

  async function handleSubmit() {
    if (!confirm('Biztosan beküldöd a rituálét? Utána nem módosítható.')) return
    setSubmitting(true)
    setError('')
    const { error: err } = await supabase.rpc('submit_ritual', {
      p_inventory_ids: Object.values(selected)
    })
    setSubmitting(false)
    if (err) setError(err.message)
    else setSubmitted(true)
  }

  if (!profile?.is_captain) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center">
        <div>
          <p className="text-ritual-bone mb-4">A rituálét a csapatkapitány állítja össze és küldi be.</p>
          <button
            onClick={() => navigate('/lobby')}
            className="rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
          >
            Vissza
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center">
        <div>
          <p className="font-display text-2xl text-ritual-orange mb-3">A rituálé elindult…</p>
          <p className="text-ritual-gray">Nézzétek a nagy kivetítőt — hamarosan sorra kerültök!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <h1 className="font-display text-2xl text-ritual-orange mb-2">A rituálé összeállítása</h1>
      {deadline && (
        <p className="text-ritual-gray text-sm mb-3">
          Beküldési határidő:{' '}
          <span className="text-ritual-bone font-semibold">
            {formatClock(deadline - Date.now())}
          </span>
        </p>
      )}
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
                    onClick={() => setSelected((s) => ({ ...s, [ingredientId]: opt.id }))}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm border ${
                      selected[ingredientId] === opt.id
                        ? 'border-ritual-orange text-ritual-orange'
                        : 'border-ritual-purple text-ritual-gray'
                    }`}
                  >
                    {i + 1}. példány ({opt.room_name})
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-monster-vampire text-sm mb-4">{error}</p>}

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
