import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const LIMIT_MS = 5 * 60 * 1000

// Fisher-Yates — a válaszopciók sorrendje véletlenszerű, hogy ne lehessen
// a betűjel alapján tippelni.
function shuffle(array) {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function Task({ profile }) {
  const { stationId } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [options, setOptions] = useState([])
  const [deadline, setDeadline] = useState(null) // szerver-időben, ms
  const [offset, setOffset] = useState(0) // szerver - kliens óra eltérése, ms
  const [left, setLeft] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase.rpc('get_task_for_me', {
        p_station_id: stationId
      })
      if (err || !data?.[0]) {
        setError(err?.message || 'A feladat nem érhető el.')
        return
      }
      const row = data[0]
      setTask(row)
      setOptions(shuffle(row.options ?? []))
      setOffset(new Date(row.server_now).getTime() - Date.now())
      setDeadline(new Date(row.started_at).getTime() + LIMIT_MS)
    }
    load()
  }, [stationId])

  useEffect(() => {
    if (!deadline) return
    const id = setInterval(() => setLeft(deadline - (Date.now() + offset)), 500)
    return () => clearInterval(id)
  }, [deadline, offset])

  const expired = left !== null && left <= 0
  const isCaptain = !!profile?.is_captain

  async function handleSubmit(optionId) {
    setSubmitting(true)
    setError('')
    const { data, error: err } = await supabase.rpc('submit_answer', {
      p_station_id: stationId,
      p_option_id: optionId
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data === 'failed') setFailed(true)
    else navigate('/lobby', { replace: true })
  }

  if (error && !task) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center">
        <div>
          <p className="text-ritual-bone mb-4">{error}</p>
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

  if (failed || expired) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center">
        <div>
          <p className="font-display text-2xl text-monster-vampire mb-4">
            Ez most sajnos nem sikerült
          </p>
          <button
            onClick={() => navigate('/lobby', { replace: true })}
            className="rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
          >
            Tovább
          </button>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black">
        <p className="text-ritual-gray">Betöltés…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <div className="flex items-center justify-between mb-2">
        <p className="text-ritual-gray text-sm">Feladat</p>
        {left !== null && (
          <p className="text-ritual-orange font-semibold tabular-nums">{formatClock(left)}</p>
        )}
      </div>
      <h1 className="font-display text-xl text-ritual-bone mb-5">{task.prompt}</h1>

      {task.my_fragment && (
        <div className="bg-ritual-purple/30 border border-ritual-orange rounded-xl p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-ritual-orange mb-1">
            Ez csak a Tiéd
          </p>
          <p className="text-ritual-bone">{task.my_fragment.text}</p>
        </div>
      )}

      <p className="text-ritual-gray text-sm mb-3">
        Beszéljétek meg szóban, mit lát mindenki, majd a kapitány küldi be a választ.
      </p>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={opt.id}
            disabled={!isCaptain || submitting}
            onClick={() => handleSubmit(opt.id)}
            className="w-full text-left rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone disabled:opacity-40 enabled:hover:border-ritual-orange"
          >
            <span className="text-ritual-orange font-semibold mr-2">
              {String.fromCharCode(97 + i)})
            </span>
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="text-monster-vampire text-sm mt-4">{error}</p>}
      {!isCaptain && (
        <p className="text-center text-ritual-gray text-xs mt-4">
          Csak a kapitány küldheti be a választ.
        </p>
      )}
    </div>
  )
}
