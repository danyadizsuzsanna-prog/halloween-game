import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function Stat({ label, value, tone = '' }) {
  return (
    <div className="flex-1 bg-ritual-purpleDark border border-ritual-purple rounded-xl px-3 py-3 text-center">
      <p className={`font-display text-2xl ${tone || 'text-ritual-orange'}`}>{value}</p>
      <p className="text-ritual-gray text-[11px] uppercase tracking-wide mt-1">{label}</p>
    </div>
  )
}

// Stáb kezdőlap: a várakozó szoba vezérlője. A stáb tagjai nem játszanak,
// ezért nincs csapatuk — innen indítják a beosztást és követik a csapatokat.
export default function StaffHome({ profile }) {
  const navigate = useNavigate()
  const [ov, setOv] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('staff_get_overview')
    if (err) setError(err.message)
    else {
      setOv(data)
      setError('')
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [load])

  async function run(fn, okMsg) {
    setBusy(true)
    setError('')
    setMsg('')
    const { data, error: err } = await fn()
    if (err) setError(err.message)
    else setMsg(typeof okMsg === 'function' ? okMsg(data) : okMsg)
    await load()
    setBusy(false)
  }

  function handleAssign() {
    if (!ov) return
    const p = ov.plan
    const txt =
      `${ov.named_players} játékos → ${p.teams} csapat, csapatonként ${
        p.min_size === p.max_size ? p.min_size : `${p.min_size}–${p.max_size}`
      } fő.\n\nIndulhat a beosztás?`
    if (!window.confirm(txt)) return
    run(() => supabase.rpc('assign_teams', { p_force: false }), 'A csapatok kialakultak.')
  }

  function handleReshuffle() {
    if (!window.confirm('Újrakeverés: MINDEN csapat, kapitány és csapatnév törlődik, és új, véletlen beosztás készül. Biztos?')) return
    run(() => supabase.rpc('assign_teams', { p_force: true }), 'Újrakevertük a csapatokat.')
  }

  function handleClear() {
    if (!window.confirm('Beosztás törlése: mindenki visszakerül a várakozó szobába, a csapatnevek és kapitányok törlődnek. Biztos?')) return
    run(() => supabase.rpc('reset_team_assignment'), 'A beosztás törölve, mindenki a várakozó szobában van.')
  }

  function handlePlaceWaiting() {
    run(
      () => supabase.rpc('place_waiting_players'),
      (left) => (left ? `Még ${left} fő csapat nélkül.` : 'A várakozók beosztva a legkisebb csapatokba.')
    )
  }

  const teamsExist = !!ov?.teams_exist
  const waiting = ov?.waiting ?? []
  const locked = !!ov?.game_started

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <h1 className="font-display text-2xl text-ritual-orange mb-1">Stáb — csapatbeosztás</h1>
      <p className="text-ritual-gray text-sm mb-4">Szia, {profile.display_name}! Te nem játszol, nincs csapatod.</p>

      {!ov && !error && <p className="text-ritual-gray">Betöltés…</p>}

      {ov && (
        <>
          <div className="flex gap-2 mb-4">
            <Stat label="névvel" value={ov.named_players} />
            <Stat
              label="névre vár"
              value={ov.unnamed_players}
              tone={ov.unnamed_players > 0 ? 'text-monster-vampire' : 'text-ritual-gray'}
            />
            <Stat label="csapat" value={ov.teams.length} />
          </div>

          {/* --- még nincs beosztás --- */}
          {!teamsExist && (
            <>
              <div className="bg-ritual-purpleDark border border-ritual-purple rounded-2xl p-4 mb-4">
                <p className="text-ritual-gray text-xs uppercase tracking-wide mb-1">Terv</p>
                {ov.named_players >= 2 ? (
                  <p className="text-ritual-bone">
                    <span className="text-ritual-orange font-semibold">{ov.plan.teams} csapat</span>, csapatonként{' '}
                    <span className="text-ritual-orange font-semibold">
                      {ov.plan.min_size === ov.plan.max_size
                        ? ov.plan.min_size
                        : `${ov.plan.min_size}–${ov.plan.max_size}`}{' '}
                      fő
                    </span>
                  </p>
                ) : (
                  <p className="text-ritual-gray">Legalább 2 játékos kell a beosztáshoz.</p>
                )}
                {ov.unnamed_players > 0 && (
                  <p className="text-monster-vampire text-sm mt-2">
                    {ov.unnamed_players} fő még nem adta meg a nevét — őket most nem osztjuk be (később, a nevük
                    megadása után automatikusan a legkisebb csapatba kerülnek).
                  </p>
                )}
              </div>

              <button
                onClick={handleAssign}
                disabled={busy || ov.named_players < 2}
                className="w-full rounded-xl px-4 py-4 mb-5 bg-ritual-orange text-ritual-black font-semibold text-lg disabled:opacity-50"
              >
                {busy ? 'Beosztás…' : '🎲 Csapatok kialakítása'}
              </button>

              <p className="text-ritual-gray text-xs uppercase tracking-wide mb-2">Várakozók ({waiting.length})</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {waiting.map((n, i) => (
                  <span key={`${n}-${i}`} className="rounded-full px-3 py-1 text-sm bg-ritual-purpleDark text-ritual-bone">
                    {n}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* --- már van beosztás --- */}
          {teamsExist && (
            <>
              {waiting.length > 0 && (
                <div className="bg-ritual-purpleDark border border-monster-vampire rounded-2xl p-4 mb-4">
                  <p className="text-ritual-bone mb-1">
                    <span className="font-semibold text-monster-vampire">{waiting.length} fő</span> csapat nélkül maradt
                    (a csapatok már 8 fősek):
                  </p>
                  <p className="text-ritual-gray text-sm mb-3">{waiting.join(', ')}</p>
                  <button
                    onClick={handlePlaceWaiting}
                    disabled={busy}
                    className="w-full rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
                  >
                    Várakozók beosztása a legkisebb csapatokba
                  </button>
                  {!locked && (
                    <p className="text-ritual-gray text-xs mt-2">
                      Tipp: a játék indulása előtt az "Újrakeverés" a szabályok szerint új csapatszámot számol.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3 mb-5">
                {ov.teams.map((t) => (
                  <div key={t.id} className="bg-ritual-purpleDark border border-ritual-purple rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-display text-ritual-bone">{t.name}</p>
                      <span className="text-ritual-gray text-xs">
                        {t.members.length} fő{!t.name_chosen && ' · névre vár'}
                      </span>
                    </div>
                    <p className="text-sm text-ritual-gray">
                      {t.members.map((m, i) => (
                        <span key={`${m.name}-${i}`}>
                          {i > 0 && ', '}
                          <span className={m.is_captain ? 'text-ritual-orange' : 'text-ritual-bone'}>
                            {m.is_captain && '👑 '}
                            {m.name}
                          </span>
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>

              {locked ? (
                <p className="text-ritual-gray text-sm mb-5">
                  A játék fut — a beosztás már nem módosítható. (Visszaállításhoz használd a kivetítő nézet
                  beállításait.)
                </p>
              ) : (
                <div className="flex gap-3 mb-5">
                  <button
                    onClick={handleReshuffle}
                    disabled={busy}
                    className="flex-1 rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone disabled:opacity-50"
                  >
                    🔀 Újrakeverés
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={busy}
                    className="flex-1 rounded-xl px-4 py-3 bg-ritual-purpleDark border border-monster-vampire text-monster-vampire disabled:opacity-50"
                  >
                    Beosztás törlése
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {msg && <p className="text-ritual-orange text-sm mb-3">{msg}</p>}
      {error && <p className="text-monster-vampire text-sm mb-3">{error}</p>}

      <button
        onClick={() => navigate('/presenter')}
        className="w-full rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone mb-3"
      >
        📺 Kivetítő megnyitása (játék indítása, rituálé)
      </button>
      <button onClick={() => supabase.auth.signOut()} className="text-ritual-gray text-xs underline">
        Kijelentkezés
      </button>
    </div>
  )
}
