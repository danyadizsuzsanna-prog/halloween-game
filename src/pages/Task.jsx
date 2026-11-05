import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const LIMIT_MS = 5 * 60 * 1000

// A médiafájlok (kép/hang/videó) a public mappából jönnek; a GitHub Pages
// alkönyvtára miatt a BASE_URL-t elé kell tenni. Teljes URL-t változatlanul hagyunk.
const mediaUrl = (u) =>
  /^https?:\/\//.test(u) ? u : `${import.meta.env?.BASE_URL ?? '/'}${u.replace(/^\//, '')}`

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
  const [answers, setAnswers] = useState([''])
  const [confirming, setConfirming] = useState(false)
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
      setAnswers(Array.from({ length: row.answer_slots || 1 }, () => ''))
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

  const filled = answers.map((x) => x.trim())
  const canSubmit = isCaptain && !submitting && filled.every((x) => x.length > 0)

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    const { data, error: err } = await supabase.rpc('submit_answer', {
      p_station_id: stationId,
      p_answers: filled
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      setConfirming(false)
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
      {task.title && (
        <h1 className="font-display text-xl text-ritual-orange mb-3">{task.title}</h1>
      )}

      <div className="bg-ritual-purpleDark border border-ritual-purple rounded-2xl p-4 mb-5">
        <p
          className="text-ritual-bone text-lg leading-relaxed"
          style={{ whiteSpace: 'pre-line' }}
        >
          {task.prompt}
        </p>
        {task.image_url && (
          <img src={mediaUrl(task.image_url)} alt="" className="w-full rounded-xl mt-4" />
        )}
        {task.audio_url && (
          <audio src={mediaUrl(task.audio_url)} controls className="w-full mt-4" />
        )}
        {task.video_url && (
          <video
            src={mediaUrl(task.video_url)}
            controls
            muted
            loop
            playsInline
            preload="auto"
            className="w-full rounded-xl mt-4 bg-black"
          />
        )}
      </div>

      <p className="text-ritual-gray text-sm mb-3">
        {answers.length > 1
          ? `Oldjátok meg együtt — a kapitány beírja mind a ${answers.length} választ.`
          : 'Oldjátok meg együtt — a kapitány beírja a választ.'}
      </p>

      <div className="space-y-2">
        {answers.map((val, i) => (
          <input
            key={i}
            value={val}
            disabled={!isCaptain || submitting || confirming}
            onChange={(e) =>
              setAnswers((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
            }
            placeholder={answers.length > 1 ? `${i + 1}. válasz` : 'Válasz'}
            autoComplete="off"
            autoCapitalize="none"
            className="w-full rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone placeholder:text-ritual-gray focus:outline-none focus:border-ritual-orange disabled:opacity-40"
          />
        ))}
      </div>

      {!confirming ? (
        <button
          disabled={!canSubmit}
          onClick={() => setConfirming(true)}
          className="w-full mt-4 rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-40"
        >
          Beküldés
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-ritual-orange p-4">
          <p className="text-ritual-bone text-sm mb-1">Biztosan ezt küldöd be?</p>
          <p className="text-ritual-orange font-semibold mb-3 break-words">
            {filled.join(' · ')}
          </p>
          <p className="text-ritual-gray text-xs mb-3">
            Beküldés után nem lehet javítani — ellenőrizd a helyesírást!
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="flex-1 rounded-xl px-4 py-3 border border-ritual-purple text-ritual-gray"
            >
              Javítom
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
            >
              {submitting ? 'Küldés…' : 'Igen, beküldöm'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-monster-vampire text-sm mt-4">{error}</p>}
      {!isCaptain && (
        <p className="text-center text-ritual-gray text-xs mt-4">
          Csak a kapitány küldheti be a választ.
        </p>
      )}
    </div>
  )
}
