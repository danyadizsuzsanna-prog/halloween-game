import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// Fisher-Yates — a válaszopciók sorrendje mindig véletlenszerű, hogy ne
// lehessen a betűjel alapján tippelni.
function shuffle(array) {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Task({ profile }) {
  const { stationId } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [options, setOptions] = useState([])
  const [myFragment, setMyFragment] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    async function load() {
      // Az óra itt indul el — a task megnyitásakor, NEM a beküldéskor.
      // Bármelyik csapattag hívhatja, aki elsőnek nyitja meg a feladatot.
      await supabase.rpc('start_attempt', { p_station_id: stationId })

      const { data: taskData } = await supabase
        .from('public_tasks')
        .select('*')
        .eq('station_id', stationId)
        .single()
      setTask(taskData)

      const { data: optionData } = await supabase
        .from('public_answer_options')
        .select('*')
        .eq('task_id', taskData.id)
      setOptions(shuffle(optionData ?? []))

      const { data: teammates } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', profile.team_id)
        .order('id', { ascending: true })

      const myIndex = teammates.findIndex((t) => t.id === profile.id)
      const fragments = taskData.fragments ?? []
      setMyFragment(fragments[myIndex % fragments.length] ?? fragments[0])
    }
    load()
  }, [stationId, profile.id, profile.team_id])

  const isCaptain = profile.is_captain

  async function handleSubmit(optionId) {
    setSubmitting(true)
    const { data, error } = await supabase.rpc('submit_answer', {
      p_station_id: stationId,
      p_option_id: optionId
    })
    setSubmitting(false)
    if (error) {
      alert(error.message)
      return
    }
    if (data === 'failed') {
      setResult('failed')
    } else {
      navigate('/lobby')
    }
  }

  if (!task) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black">
        <p className="text-ritual-gray">Betöltés…</p>
      </div>
    )
  }

  if (result === 'failed') {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center">
        <p className="font-display text-2xl text-monster-vampire mb-3">
          Ez most sajnos nem sikerült
        </p>
        <button
          onClick={() => navigate('/lobby')}
          className="rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
        >
          Vissza a térképhez
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <p className="text-ritual-gray text-sm mb-2">Feladat</p>
      <h1 className="font-display text-xl text-ritual-bone mb-5">{task.prompt}</h1>

      {myFragment && (
        <div className="bg-ritual-purple/30 border border-ritual-orange rounded-xl p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-ritual-orange mb-1">
            Ez csak a Tiéd — {myFragment.role}
          </p>
          <p className="text-ritual-bone">{myFragment.text}</p>
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

      {!isCaptain && (
        <p className="text-center text-ritual-gray text-xs mt-4">
          Csak a kapitány küldheti be a választ.
        </p>
      )}
    </div>
  )
}
