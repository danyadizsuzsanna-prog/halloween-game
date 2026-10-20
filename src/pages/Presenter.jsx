import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MONSTER_LABEL = {
  vampire: { text: 'Vámpírok törtek be!', color: 'text-monster-vampire' },
  ghost: { text: 'Szellemek szabadultak el!', color: 'text-monster-ghost' },
  werewolf: { text: 'Vérfarkasok érkeztek!', color: 'text-monster-werewolf' }
}

export default function Presenter({ profile }) {
  const [submissions, setSubmissions] = useState([])
  const [index, setIndex] = useState(0)
  const [gatherMinutes, setGatherMinutes] = useState(40)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    if (!profile?.is_staff) return
    async function load() {
      const [{ data: subs }, { data: cfg }] = await Promise.all([
        supabase
          .from('ritual_submissions')
          .select('*, teams(name)')
          .order('submitted_at', { ascending: true }),
        supabase.from('game_config').select('*').single()
      ])
      setSubmissions(subs ?? [])
      setConfig(cfg)
    }
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [profile?.is_staff])

  if (!profile?.is_staff) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black">
        <p className="text-ritual-gray">Ehhez a nézethez stáb-jogosultság kell.</p>
      </div>
    )
  }

  const current = submissions[index]
  const running = !!config?.starts_at

  const leaderboard = [...submissions]
    .filter((s) => s.is_complete && !s.final_monster)
    .sort((a, b) => (b.freshness_score ?? 0) - (a.freshness_score ?? 0))
    .slice(0, 3)

  async function handleStart() {
    if (!confirm(`Elindítod a játékot? (${gatherMinutes} perc gyűjtés + 5 perc rituálé)`)) return
    const { error } = await supabase.rpc('start_game', {
      p_gather_minutes: gatherMinutes,
      p_ritual_minutes: 5
    })
    alert(error ? error.message : 'A játék elindult!')
  }

  async function handleReset() {
    if (!confirm('BIZTOSAN törlöd az összes játékállást (feladatok, alapanyagok, rituálék)?')) return
    const { error } = await supabase.rpc('reset_game')
    alert(error ? error.message : 'Visszaállítva.')
  }

  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-ritual-black flex flex-col items-center justify-center px-10 text-center safe-top safe-bottom">
        <p className="font-display text-3xl text-ritual-orange mb-8">🏆 Dobogó 🏆</p>
        {leaderboard.length === 0 ? (
          <p className="text-ritual-gray">Még nincs tiszta rituálé.</p>
        ) : (
          <ol className="space-y-4">
            {leaderboard.map((s, i) => (
              <li key={s.id} className="font-display text-2xl text-ritual-bone">
                {i + 1}. {s.teams.name}
              </li>
            ))}
          </ol>
        )}
        <button
          onClick={() => setShowLeaderboard(false)}
          className="mt-10 rounded-xl px-4 py-2 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
        >
          Vissza a levetítéshez
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ritual-black flex flex-col items-center justify-center px-10 text-center safe-top safe-bottom">
      {!current ? (
        <>
          <p className="text-ritual-gray mb-6">
            {running ? 'A játék fut — még nincs beküldött rituálé.' : 'A játék még nem indult el.'}
          </p>
          <div className="flex items-center gap-3 mb-6">
            <input
              type="number"
              value={gatherMinutes}
              onChange={(e) => setGatherMinutes(Number(e.target.value))}
              className="w-20 rounded-lg px-3 py-2 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone text-center"
            />
            <button
              onClick={handleStart}
              className="rounded-xl px-5 py-3 bg-ritual-orange text-ritual-black font-semibold"
            >
              Játék indítása ({gatherMinutes} perc + 5 perc rituálé)
            </button>
          </div>
          <button
            onClick={handleReset}
            className="rounded-xl px-4 py-2 bg-transparent border border-ritual-red text-ritual-red text-sm"
          >
            Játékállás törlése (főpróba után)
          </button>
        </>
      ) : (
        <>
          <p className="font-display text-3xl text-ritual-bone mb-4">{current.teams.name}</p>
          {!current.is_complete ? (
            <p className="font-display text-4xl text-ritual-gray">Ez most sajnos nem sikerült</p>
          ) : current.final_monster ? (
            <p className={`font-display text-4xl ${MONSTER_LABEL[current.final_monster].color}`}>
              {MONSTER_LABEL[current.final_monster].text}
            </p>
          ) : (
            <div>
              <p className="font-display text-4xl text-ritual-orange mb-2">Sikeres rituálé! ✨</p>
              <p className="text-ritual-gray">
                Frissesség-pontszám: {Number(current.freshness_score ?? 0).toFixed(2)}
              </p>
            </div>
          )}
          <div className="mt-10 flex gap-3">
            <button
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              className="rounded-xl px-4 py-2 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone disabled:opacity-40"
            >
              ← Előző
            </button>
            <button
              disabled={index >= submissions.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              className="rounded-xl px-4 py-2 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone disabled:opacity-40"
            >
              Következő csapat →
            </button>
            <button
              onClick={() => setShowLeaderboard(true)}
              className="rounded-xl px-4 py-2 bg-ritual-orange text-ritual-black font-semibold"
            >
              🏆 Dobogó
            </button>
          </div>
        </>
      )}
    </div>
  )
}
