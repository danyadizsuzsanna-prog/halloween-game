import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RitualStage from '../components/RitualStage'
import { useConfirm } from '../components/ConfirmProvider'
import { rankSubmissions, formatElapsed, freshnessLabel } from '../lib/ranking'

// Kivetítő-nézet (csak stáb). Billentyűk:
//   Szóköz / Enter / →   lejátszás indítása, majd a következő csapat
//   ←                    előző csapat
//   R                    az aktuális rituálé újrajátszása
//   T                    dobogó
//   G                    beállítások (játék indítása / törlése)
//   F                    teljes képernyő

function Podium({ submissions, startsAt }) {
  const ranked = useMemo(() => rankSubmissions(submissions, startsAt).slice(0, 3), [submissions, startsAt])

  if (ranked.length === 0) {
    return (
      <div className="h-full grid place-items-center text-center px-10">
        <div>
          <p className="font-display text-ritual-orange text-[6vh] mb-4">Nincs győztes</p>
          <p className="text-ritual-gray text-[3vh]">Egyik csapat rituáléja sem sikerült tisztán.</p>
        </div>
      </div>
    )
  }

  const winner = ranked[0]
  // vizuális sorrend: 2. – 1. – 3.
  const visual = [ranked[1], ranked[0], ranked[2]].filter(Boolean)
  const style = {
    1: { h: '30vh', color: '#e8a24a', medal: '1.', delay: '2.6s' },
    2: { h: '22vh', color: '#cfd3dc', medal: '2.', delay: '1.5s' },
    3: { h: '15vh', color: '#c58a4d', medal: '3.', delay: '.4s' }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <p className="text-ritual-bone/60" style={{ fontSize: '3vh', letterSpacing: '.3em' }}>
        A GYŐZTES
      </p>
      <p
        className="font-display text-center leading-tight rs-sub"
        style={{
          '--sdl': '3.4s',
          fontSize: '9vh',
          color: '#e8a24a',
          textShadow: '0 0 5vh #e8a24acc, 0 .4vh 0 #000',
          margin: '1vh 0 .5vh'
        }}
      >
        {winner.team_name}
      </p>
      <p className="text-ritual-bone/85 rs-sub" style={{ '--sdl': '3.6s', fontSize: '3vh', marginBottom: '4vh' }}>
        ⏱ {formatElapsed(winner.elapsed)} · {freshnessLabel(winner.stale)}
        {winner.tied && <span className="block text-ritual-gray" style={{ fontSize: '2vh' }}>(azonos időpont — sorsolás döntött)</span>}
      </p>
      <div className="flex items-end gap-[2vw]">
        {visual.map((s) => {
          const st = style[s.rank]
          return (
            <div key={s.id} className="flex flex-col items-center rs-sub" style={{ '--sdl': st.delay, width: '24vw' }}>
              <p className="font-display text-ritual-bone text-[3.4vh] text-center leading-tight mb-[1vh] px-2">{s.team_name}</p>
              <p className="text-[2.2vh] mb-[1.2vh] text-center" style={{ color: st.color }}>
                ⏱ {formatElapsed(s.elapsed)}
                <span className="block text-ritual-bone/70" style={{ fontSize: '1.9vh' }}>
                  {freshnessLabel(s.stale)}
                </span>
              </p>
              <div
                className="w-full rounded-t-xl grid place-items-center font-display"
                style={{
                  height: st.h,
                  fontSize: '8vh',
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
  const confirm = useConfirm()
  const [submissions, setSubmissions] = useState([])
  const [config, setConfig] = useState(null)
  const [detailMissing, setDetailMissing] = useState(false)
  const [index, setIndex] = useState(0)
  const [play, setPlay] = useState(false)
  const [phase, setPhase] = useState('ready')
  const [replayKey, setReplayKey] = useState(0)
  const [skipSignal, setSkipSignal] = useState(0)
  const [view, setView] = useState('stage') // 'stage' | 'podium'
  const [adminOpen, setAdminOpen] = useState(false)
  const [gatherMinutes, setGatherMinutes] = useState(70)
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
    } else if (phase === 'video') {
      setSkipSignal((k) => k + 1) // a videó átugrása
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
    const ok = await confirm({
      title: 'Elindítod a játékot?',
      message: `${gatherMinutes} perc gyűjtés, utána 5 perc a rituálé összeállítására.`,
      confirmText: 'Indítás'
    })
    if (!ok) return
    const { error } = await supabase.rpc('start_game', { p_gather_minutes: gatherMinutes, p_ritual_minutes: 5 })
    setAdminMsg(error ? `Hiba: ${error.message}` : 'A játék elindult!')
    load()
  }

  async function handleReset() {
    const ok = await confirm({
      title: 'Játékállás törlése',
      message: 'Az összes próbálkozás, alapanyag és beküldött rituálé törlődik, és a játék leáll. A csapatok megmaradnak.',
      confirmText: 'Igen, törlöm',
      danger: true
    })
    if (!ok) return
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
      : phase === 'video'
        ? '⏭ Átugrás'
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
        <Podium submissions={submissions} startsAt={config?.starts_at} />
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
          skipSignal={skipSignal}
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
            disabled={play && phase !== 'reveal' && phase !== 'video'}
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

            <p className="text-ritual-gray text-xs mb-2">
              Mind a 12 állomás kötelező. Javasolt gyűjtési idő: ~30 főig 65 perc · 31–42 fő 70 · 43–54 fő 75 ·
              55–66 fő 80 · 67 fő fölött 85–90 perc.
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
