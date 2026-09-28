import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Lobby({ profile }) {
  const navigate = useNavigate()
  const [teammates, setTeammates] = useState([])
  const [config, setConfig] = useState(null)
  const [options, setOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [claiming, setClaiming] = useState(false)

  const loadTeammates = useCallback(async () => {
    if (!profile?.team_id) return
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_captain')
      .eq('team_id', profile.team_id)
    setTeammates(data ?? [])
  }, [profile?.team_id])

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from('game_config').select('*').single()
    setConfig(data)
  }, [])

  const loadOptions = useCallback(async () => {
    if (!config?.ends_at) return
    setLoadingOptions(true)
    const { data, error } = await supabase.rpc('get_routing_options', {
      p_game_ends_at: config.ends_at
    })
    if (!error) setOptions(data ?? [])
    setLoadingOptions(false)
  }, [config?.ends_at])

  useEffect(() => {
    loadTeammates()
    loadConfig()
    // élő frissítés: ha bárki a csapatból elindul egy feladatra, vagy a
    // kapitányt megválasztják, mindenki lássa
    const channel = supabase
      .channel('lobby-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        loadTeammates
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadTeammates, loadConfig])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  async function handleClaimCaptain() {
    setClaiming(true)
    const { error } = await supabase.rpc('claim_captain', { p_team_id: profile.team_id })
    if (error) alert(error.message)
    await loadTeammates()
    setClaiming(false)
  }

  const hasCaptain = teammates.some((t) => t.is_captain)
  const isMeCaptain = teammates.find((t) => t.id === profile?.id)?.is_captain

  const gameNotStarted = !config?.starts_at
  const gameOver = config?.ends_at && new Date(config.ends_at) < new Date()

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <h1 className="font-display text-2xl text-ritual-orange mb-1">
        {teammates.length > 0 ? 'A csapatod' : 'Csapat betöltése…'}
      </h1>
      <p className="text-ritual-gray text-sm mb-6">
        {teammates.length} fő a csapatban
      </p>

      <ul className="space-y-2 mb-6">
        {teammates.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between bg-ritual-purpleDark rounded-xl px-4 py-3"
          >
            <span>{t.display_name || t.email}</span>
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
          className="w-full rounded-xl px-4 py-3 mb-6 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
        >
          {claiming ? 'Foglalás…' : '👑 Legyek én a kapitány'}
        </button>
      )}

      {gameNotStarted && (
        <div className="bg-ritual-purpleDark border border-ritual-purple rounded-xl p-4 text-center text-ritual-gray">
          A stáb még nem indította el a játékot — kérlek várj a jelre!
        </div>
      )}

      {!gameNotStarted && !gameOver && (
        <>
          <h2 className="font-display text-lg text-ritual-bone mb-3">Merre tovább?</h2>
          {loadingOptions && <p className="text-ritual-gray">Betöltés…</p>}
          <div className="space-y-3">
            {options.map((opt) => (
              <button
                key={opt.station_id}
                onClick={() => navigate(`/task/${opt.station_id}`)}
                className="w-full text-left rounded-xl px-4 py-4 bg-ritual-purpleDark border border-ritual-purple hover:border-ritual-orange transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ritual-bone">
                    {opt.ingredient_name}
                    {opt.is_backup && (
                      <span className="ml-2 text-xs text-ritual-orange">(tartalék)</span>
                    )}
                  </span>
                  {opt.is_busy ? (
                    <span className="text-xs text-monster-vampire">
                      Foglalt (~{Math.max(0, Math.ceil((opt.busy_seconds_left ?? 0) / 60))} perc)
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

      {gameOver && (
        <div className="bg-ritual-purpleDark border border-ritual-purple rounded-xl p-4 text-center text-ritual-bone">
          Lejárt a gyűjtögető idő. Irány a rituálé összeállítása!
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="flex-1 rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
        >
          Alapanyagok
        </button>
        {isMeCaptain && (
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
