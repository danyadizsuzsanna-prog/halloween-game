import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RitualStage from '../components/RitualStage'

// Kivetítő-nézet (csak stáb). Billentyűk:
//   Szóköz / Enter / →   lejátszás indítása, majd a következő csapat
//   ←                    előző csapat
//   R                    az aktuális rituálé újrajátszása
//   T                    dobogó
//   G                    beállítások (játék indítása / törlése)
//   F                    teljes képernyő

// Döntetlennél "véletlen" sorrend, de stabil: ne ugráljon a lista frissítéskor.
function stableRandom(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function Podium({ submissions }) {
  const ranked = useMemo(() => {
    const list = submissions
      .filter((s) => s.is_complete && !s.final_monster)
      .map((s) => ({ ...s, score: Number(s.freshness_score ?? 0) }))
      .sort((a, b) => b.score - a.score || stableRandom(a.id) - stableRandom(b.id))
      .slice(0, 3)
    return list.map((s, i) => ({
      ...s,
      rank: i + 1,
      tied: (list[i - 1] && list[i - 1].score === s.score) || (list[i + 1] && list[i + 1].score === s.score)
    }))
  }, [submissions])

  if (ranked.length === 0) {
    return (
      <div className="h-full grid place-items-center text-center px-10">
        <div>
          <p className="font-display text-ritual-orange text-[6vh] mb-4">Dobogó</p>
          <p className="text-ritual-gray text-[3vh]">Egyik csapat rituáléja sem sikerült tisztán — most nincs dobogós.</p>
        </div>
      </div>
    )
  }

  // vizuális sorrend: 2. – 1. – 3.
  const visual = [ranked[1], ranked[0], ranked[2]].filter(Boolean)
  const style = {
    1: { h: '38vh', color: '#e8a24a', medal: '1.', delay: '2.6s' },
    2: { h: '28vh', color: '#cfd3dc', medal: '2.', delay: '1.5s' },
    3: { h: '20vh', color: '#c58a4d', medal: '3.', delay: '.4s' }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <p className="font-display text-ritual-orange text-[6vh] mb-[5vh]">Dobogó</p>
      <div className="flex items-end gap-[2vw]">
        {visual.map((s) => {
          const st = style[s.rank]
          return (
            <div key={s.id} className="flex flex-col items-center rs-sub" style={{ '--sdl': st.delay, width: '24vw' }}>
              <p className="font-display text-ritual-bone text-[3.6vh] text-center leading-tight mb-[1.5vh] px-2">{s.team_name}</p>
              <p className="text-[2.4vh] mb-[1.5vh]" style={{ color: st.color }}>
                A rituálé ereje: {Math.round(s.score * 100)}%
                {s.tied && <span className="block text-ritual-gray text-[1.8vh]">(döntetlen — sorsolás döntött)</span>}
              </p>
              <div
                className="w-full rounded-t-xl grid place-items-center font-display"
                style={{
                  height: st.h,
                  fontSize: '9vh',
                  color: '#17111f',
                  background: `linear-gradient(180deg, ${st.color} 0%, ${st.color}99 100%)`
                }}
              >
                {st.medal}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Presenter({ profile }) {
  const [submissions, setSubmissions] = useState([])
  const [config, setConfig] = useState(null)
  const [detailMissing, setDetailMissing] = useState(false)
  const [index, setIndex] = useState(0)
  const [play, setPlay] = useState(false)
  const [phase, setPhase] = useState('ready')
  const [replayKey, setReplayKey] = useState(0)
  const [view, setView] = useState('stage') // 'stage' | 'podium'
  const [adminOpen, setAdminOpen] = useState(false)
  const [gatherMinutes, setGatherMinutes] = useState(40)
  const [adminMsg, setAdminMsg] = useState('')

  const isStaff = !!profile?.is_staff

  const load = useCallback(async () => {
    const [{ data: cfg }, showcase] = await Promise.all([
      supabase.from('game_config').select('*').single(),
      supabase.rpc('get_ritual_showcase')
    ])
    setConfig(cfg)
    if (!showcase.error && Array.isArray(showcase.data)) {
      setSubmissions(showcase.data)
      setDetailMissing(false)
    } else {
      // A 0004 migráció még nincs lefuttatva: egyszerűsített lejátszás (részletek nélkül).
      const { data: subs } = await supabase
        .from('ritual_submissions')
        .select('*, teams(name)')
        .order('submitted_at', { ascending: true })
      setSubmissions((subs ?? []).map((s) => ({ ...s, team_name: s.teams?.name ?? 'Csapat', ingredients: null })))
      setDetailMissing(true)
    }
  }, [])

  useEffect(() => {
    if (!isStaff) return
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [isStaff, load])

  const current = submissions[index]
  const running = !!config?.starts_at
  const isLast = index >= submissions.length - 1

  const primary = useCallback(() => {
    if (view === 'podium') return
    if (!current) return
    if (!play) {
      setPlay(true)
    } else if (phase === 'reveal') {
      if (isLast) {
        setView('podium')
      } else {
        setIndex((i) => i + 1)
        setPlay(false)
        setPhase('ready')
      }
    }
  }, [view, current, play, phase, isLast])

  const back = useCallback(() => {
    if (view === 'podium') {
      setView('stage')
      return
    }
    if (index > 0) {
      setIndex((i) => i - 1)
      setPlay(false)
      setPhase('ready')
    }
  }, [view, index])

  const replay = useCallback(() => {
    setPlay(false)
    setPhase('ready')
    setReplayKey((k) => k + 1)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }, [])

  useEffect(() => {
    if (!isStaff) return
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
      if (adminOpen) {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'g') setAdminOpen(false)
        return
      }
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'enter' || k === 'arrowright') {
        e.preventDefault()
        primary()
      } else if (k === 'arrowleft') back()
      else if (k === 'r') replay()
      else if (k === 't') setView((v) => (v === 'podium' ? 'stage' : 'podium'))
      else if (k === 'g') setAdminOpen(true)
      else if (k === 'f') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isStaff, adminOpen, primary, back, replay, toggleFullscreen])

  async function handleStart() {
    if (!confirm(`Elindítod a játékot? (${gatherMinutes} perc gyűjtés + 5 perc rituálé)`)) return
    const { error } = await supabase.rpc('start_game', { p_gather_minutes: gatherMinutes, p_ritual_minutes: 5 })
    setAdminMsg(error ? `Hiba: ${error.message}` : 'A játék elindult!')
    load()
  }

  async function handleReset() {
    if (!confirm('BIZTOSAN törlöd az összes játékállást (feladatok, alapanyagok, rituálék)?')) return
    const { error } = await supabase.rpc('reset_game')
    if (!error) {
      setSubmissions([])
      setIndex(0)
      setPlay(false)
      setPhase('ready')
      setView('stage')
    }
    setAdminMsg(error ? `Hiba: ${error.message}` : 'Visszaállítva — minden játékállás törölve.')
    load()
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black">
        <p className="text-ritual-gray">Ehhez a nézethez stáb-jogosultság kell.</p>
      </div>
    )
  }

  const primaryLabel = !current
    ? ''
    : !play
      ? '▶ Rituálé indítása'
      : phase !== 'reveal'
        ? '…'
        : isLast
          ? '🏆 Dobogó'
          : 'Következő csapat →'

  const btn =
    'rounded-xl px-4 py-2 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone disabled:opacity-30'

  return (
    <div className="relative h-screen overflow-hidden bg-ritual-black safe-top safe-bottom">
      {/* tartalom */}
      {view === 'podium' ? (
        <Podium submissions={submissions} />
      ) : !current ? (
        <div className="h-full grid place-items-center text-center px-10">
          <div>
            <p className="font-display text-ritual-orange text-[7vh] mb-[3vh]">Éjszakai Rituálé</p>
            <p className="text-ritual-gray text-[3vh]">
              {running ? 'A játék fut — még nincs beküldött rituálé.' : 'A játék még nem indult el.'}
            </p>
            <button
              onClick={() => setAdminOpen(true)}
              className="mt-8 rounded-xl px-5 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
            >
              ⚙ Játék indítása / törlése
            </button>
          </div>
        </div>
      ) : (
        <RitualStage
          key={`${current.id}-${replayKey}`}
          submission={current}
          play={play}
          onPhase={setPhase}
        />
      )}

      {/* alsó vezérlősáv — alapból halvány, egérmozgásra felerősödik */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
        <button className={btn} onClick={back} disabled={view === 'stage' && index === 0}>
          ←
        </button>
        {view === 'stage' && current && (
          <button
            className="rounded-xl px-5 py-2 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-40"
            onClick={primary}
            disabled={play && phase !== 'reveal'}
          >
            {primaryLabel}
          </button>
        )}
        <button className={btn} onClick={replay} disabled={!current || view === 'podium'} title="Újrajátszás (R)">
          ↻
        </button>
        <button className={btn} onClick={() => setView((v) => (v === 'podium' ? 'stage' : 'podium'))} title="Dobogó (T)">
          🏆
        </button>
        <button className={btn} onClick={toggleFullscreen} title="Teljes képernyő (F)">
          ⛶
        </button>
        <button className={btn} onClick={() => setAdminOpen(true)} title="Beállítások (G)">
          ⚙
        </button>
      </div>

      {/* sorszám */}
      {view === 'stage' && current && (
        <p className="absolute top-3 right-4 text-ritual-gray text-sm opacity-60">
          {index + 1} / {submissions.length}
        </p>
      )}

      {/* admin panel */}
      {adminOpen && (
        <div className="absolute inset-0 bg-black/70 grid place-items-center z-20" onClick={() => setAdminOpen(false)}>
          <div
            className="bg-ritual-purpleDark border border-ritual-purple rounded-2xl p-6 w-[min(92vw,520px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-ritual-orange text-2xl mb-4">Beállítások</p>

            <p className="text-ritual-gray text-sm mb-4">
              {running ? 'A játék fut.' : 'A játék még nem indult el.'} Beküldött rituálé: {submissions.length}.
            </p>

            <div className="flex items-center gap-3 mb-3">
              <input
                type="number"
                value={gatherMinutes}
                onChange={(e) => setGatherMinutes(Number(e.target.value))}
                className="w-20 rounded-lg px-3 py-2 bg-ritual-black border border-ritual-purple text-ritual-bone text-center"
              />
              <button onClick={handleStart} className="flex-1 rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold">
                Játék indítása ({gatherMinutes} + 5 perc)
              </button>
            </div>

            <button
              onClick={handleReset}
              className="w-full rounded-xl px-4 py-3 bg-transparent border border-ritual-red text-ritual-red text-sm mb-3"
            >
              Játékállás törlése (főpróba után)
            </button>

            {adminMsg && <p className="text-ritual-bone text-sm mb-3">{adminMsg}</p>}
            {detailMissing && (
              <p className="text-monster-vampire text-xs mb-3">
                A 0004 migráció még nincs lefuttatva, ezért a lejátszás egyszerűsített (a hozzávalók mind a hat helyen megjelennek).
              </p>
            )}

            <p className="text-ritual-gray text-xs mb-4">
              Billentyűk: Szóköz/→ indítás és következő · ← előző · R újrajátszás · T dobogó · F teljes képernyő · G ez a panel
            </p>
            <button onClick={() => setAdminOpen(false)} className={`${btn} w-full`}>
              Bezár
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
