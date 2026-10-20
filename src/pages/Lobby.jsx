import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import IngredientIcon from '../components/IngredientIcon'
import { randomTeamName } from '../lib/teamNames'

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function Lobby({ profile, refreshProfile }) {
  const navigate = useNavigate()
  const [teammates, setTeammates] = useState([])
  const [team, setTeam] = useState(null)
  const [nameInput, setNameInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [config, setConfig] = useState(null)
  const [target, setTarget] = useState(null)
  const [options, setOptions] = useState([])
  const [claiming, setClaiming] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState('')
  const [, setTick] = useState(0)

  const isCaptain = !!profile?.is_captain

  const refresh = useCallback(async () => {
    if (!profile?.team_id) return
    const [tm, tinfo, cfg, tgt] = await Promise.all([
      supabase.rpc('get_my_team_members'),
      supabase.from('teams').select('id, name, name_chosen').eq('id', profile.team_id).single(),
      supabase.from('game_config').select('*').single(),
      supabase.rpc('get_current_target')
    ])
    setTeammates(tm.data ?? [])
    if (tinfo.data) setTeam(tinfo.data)
    setConfig(cfg.data ?? null)
    const current = (tgt.data ?? [])[0] ?? null
    setTarget(current)

    const running = cfg.data?.starts_at && new Date(cfg.data.ends_at) > new Date()
    if (!current && running && isCaptain) {
      const { data } = await supabase.rpc('get_routing_options')
      setOptions(data ?? [])
    } else {
      setOptions([])
    }
  }, [profile?.team_id, isCaptain])

  useEffect(() => {
    refresh()
    const poll = setInterval(refresh, 4000)
    const clock = setInterval(() => setTick((t) => t + 1), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [refresh])

  async function handleClaimCaptain() {
    setClaiming(true)
    setError('')
    const { error: err } = await supabase.rpc('claim_captain', { p_team_id: profile.team_id })
    if (err) setError(err.message)
    await refreshProfile()
    await refresh()
    setClaiming(false)
  }

  async function handleSaveName(e) {
    e.preventDefault()
    const v = nameInput.replace(/\s+/g, ' ').trim()
    if (v.length < 2 || savingName) return
    setSavingName(true)
    setError('')
    const { error: err } = await supabase.rpc('set_team_name', { p_name: v })
    if (err) setError(err.message)
    else setEditingName(false)
    await refresh()
    setSavingName(false)
  }

  async function handleChoose(stationId) {
    setChoosing(true)
    setError('')
    const { error: err } = await supabase.rpc('choose_station', { p_station_id: stationId })
    if (err) setError(err.message)
    await refresh()
    setChoosing(false)
  }

  const hasCaptain = teammates.some((t) => t.is_captain)
  const nameMissing = hasCaptain && team && !team.name_chosen
  const showNameForm = isCaptain && (nameMissing || editingName)
  const now = Date.now()
  const started = !!config?.starts_at
  const gatherEnd = config?.ends_at ? new Date(config.ends_at).getTime() : null
  const gathering = started && gatherEnd && now <= gatherEnd
  const ritualEnd = config?.ritual_deadline ? new Date(config.ritual_deadline).getTime() : null

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <h1 className="font-display text-2xl text-ritual-orange mb-1">
        {team?.name_chosen ? team.name : 'A csapatod'}
        {isCaptain && team?.name_chosen && !editingName && (
          <button
            onClick={() => {
              setNameInput(team.name)
              setEditingName(true)
            }}
            className="ml-2 text-ritual-gray text-sm align-middle"
            title="Csapatnév módosítása"
          >
            ✎
          </button>
        )}
      </h1>
      <p className="text-ritual-gray text-sm mb-4">{teammates.length} fő a csapatban</p>

      <ul className="space-y-2 mb-5">
        {teammates.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between bg-ritual-purpleDark rounded-xl px-4 py-3"
          >
            <span>
              {t.display_name}
              {t.is_me && <span className="ml-2 text-ritual-gray text-xs">(te)</span>}
            </span>
            {t.is_captain && (
              <span className="text-ritual-orange text-xs font-semibold uppercase tracking-wide">
                👑 Kapitány
              </span>
            )}
          </li>
        ))}
      </ul>

      {!hasCaptain && (
        <button
          onClick={handleClaimCaptain}
          disabled={claiming}
          className="w-full rounded-xl px-4 py-3 mb-5 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
        >
          {claiming ? 'Foglalás…' : '👑 Legyek én a kapitány'}
        </button>
      )}

      {/* Csapatnév: a kapitány adja meg, a többiek várnak */}
      {showNameForm && (
        <form
          onSubmit={handleSaveName}
          className="bg-ritual-purpleDark border border-ritual-orange rounded-xl p-4 mb-5"
        >
          <p className="font-display text-lg text-ritual-orange mb-1">
            {editingName ? 'Csapatnév módosítása' : 'Adjatok nevet a csapatotoknak!'}
          </p>
          <p className="text-ritual-gray text-sm mb-3">
            Beszéljétek meg együtt — ez a név jelenik meg a nagy kivetítőn is.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              maxLength={30}
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Csapatnév"
              className="flex-1 min-w-0 rounded-xl px-4 py-3 bg-ritual-black border border-ritual-purple text-ritual-bone placeholder:text-ritual-gray focus:outline-none focus:border-ritual-orange"
            />
            <button
              type="button"
              onClick={() => setNameInput(randomTeamName(nameInput))}
              className="rounded-xl px-3 bg-ritual-black border border-ritual-purple text-xl"
              title="Véletlen név"
            >
              🎲
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingName || nameInput.trim().length < 2}
              className="flex-1 rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
            >
              {savingName ? 'Mentés…' : 'Ez lesz a nevünk'}
            </button>
            {editingName && (
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="rounded-xl px-4 py-3 bg-ritual-black border border-ritual-purple text-ritual-bone"
              >
                Mégse
              </button>
            )}
          </div>
        </form>
      )}

      {nameMissing && !isCaptain && (
        <div className="bg-ritual-purpleDark border border-ritual-purple rounded-xl p-4 mb-5 text-center text-ritual-gray">
          A kapitány éppen csapatnevet választ — szóljatok neki, ha van ötletetek!
        </div>
      )}

      {error && <p className="text-monster-vampire text-sm mb-4">{error}</p>}

      {!started && (
        <div className="bg-ritual-purpleDark border border-ritual-purple rounded-xl p-4 text-center text-ritual-gray">
          A stáb még nem indította el a játékot — kérlek várj a jelre!
        </div>
      )}

      {started && gathering && (
        <p className="text-center text-ritual-gray text-sm mb-4">
          Hátralévő gyűjtögető idő:{' '}
          <span className="text-ritual-bone font-semibold">{formatClock(gatherEnd - now)}</span>
        </p>
      )}

      {/* 1) Van aktív cél: helyszín + QR-beolvasás, vagy futó feladat */}
      {target && !target.started_at && (
        <div className="bg-ritual-purpleDark border border-ritual-orange rounded-xl p-5 text-center">
          <p className="text-ritual-gray text-sm mb-1">Menjetek ide:</p>
          <p className="font-display text-3xl text-ritual-orange mb-3">{target.room_name}</p>
          <p className="text-ritual-bone text-sm mb-4">
            Ott olvassátok be a kihelyezett QR-kódot — a feladat és az óra akkor indul el.
          </p>
          <button
            onClick={() => navigate('/scan')}
            className="w-full rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold"
          >
            📷 QR-kód beolvasása
          </button>
        </div>
      )}

      {target && target.started_at && (
        <div className="bg-ritual-purpleDark border border-ritual-orange rounded-xl p-5 text-center">
          <p className="text-ritual-bone mb-4">A feladatotok éppen fut!</p>
          <button
            onClick={() => navigate(`/task/${target.station_id}`)}
            className="w-full rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold"
          >
            Vissza a feladathoz
          </button>
        </div>
      )}

      {/* 2) Nincs aktív cél: a kapitány választ, a többiek várnak */}
      {!target && gathering && isCaptain && (
        <>
          <h2 className="font-display text-lg text-ritual-bone mb-3">Merre tovább?</h2>
          {options.length === 0 && (
            <p className="text-ritual-gray">Nincs több elérhető állomás.</p>
          )}
          <div className="space-y-3">
            {options.map((opt) => (
              <button
                key={opt.station_id}
                disabled={choosing}
                onClick={() => handleChoose(opt.station_id)}
                className="w-full text-left rounded-xl px-4 py-4 bg-ritual-purpleDark border border-ritual-purple hover:border-ritual-orange transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3 font-semibold text-ritual-bone">
                    <IngredientIcon name={opt.ingredient_name} size={40} />
                    <span>
                      {opt.ingredient_name}
                      {opt.is_backup && (
                        <span className="ml-2 text-xs text-ritual-orange">(utolsó esély)</span>
                      )}
                    </span>
                  </span>
                  {opt.is_busy ? (
                    <span className="text-xs text-monster-vampire">
                      Foglalt (~{Math.max(1, Math.ceil((opt.busy_seconds_left ?? 0) / 60))} perc)
                    </span>
                  ) : (
                    <span className="text-xs text-ritual-orange">Szabad</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {!target && gathering && !isCaptain && hasCaptain && (
        <div className="bg-ritual-purpleDark border border-ritual-purple rounded-xl p-4 text-center text-ritual-gray">
          A kapitány éppen a következő irányt választja…
        </div>
      )}

      {/* 3) A gyűjtögető idő lejárt */}
      {started && !gathering && (
        <div className="bg-ritual-purpleDark border border-ritual-purple rounded-xl p-4 text-center text-ritual-bone">
          Lejárt a gyűjtögető idő. Irány a rituálé összeállítása!
          {ritualEnd && now <= ritualEnd && (
            <p className="text-ritual-orange mt-2">
              Beküldési határidő: {formatClock(ritualEnd - now)}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="flex-1 rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
        >
          Alapanyagok
        </button>
        {isCaptain && (
          <button
            onClick={() => navigate('/ritual')}
            className="flex-1 rounded-xl px-4 py-3 bg-ritual-red text-ritual-bone font-semibold"
          >
            Rituálé összeállítása
          </button>
        )}
      </div>
    </div>
  )
}
