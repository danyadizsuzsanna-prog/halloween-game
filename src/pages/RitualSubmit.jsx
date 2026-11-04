import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import IngredientIcon, { INGREDIENTS } from '../components/IngredientIcon'
import { Cauldron } from '../components/RitualStage'
import { useConfirm } from '../components/ConfirmProvider'

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

// Rövid emlékeztető: melyik feladat, és mit válaszolt rá a csapat (a helyességet
// a játék szándékosan nem árulja el).
function answerLine(opt) {
  const title = opt.task_title ? `${opt.task_title}` : 'Feladat'
  const answer = opt.given_answer ? `válaszotok: ${opt.given_answer}` : 'válasz nem rögzítve'
  return `${title} — ${answer}`
}

// Egy példány összefoglalója: feladat címe + beírt válasz, a kérdés lenyitható.
function CopyInfo({ opt, open, onToggle }) {
  return (
    <div className="text-xs break-words">
      <p className="opacity-90">{answerLine(opt)}</p>
      {opt.task_prompt && (
        <>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onToggle()
              }
            }}
            className="inline-block mt-1 underline opacity-80 cursor-pointer"
          >
            {open ? 'Kérdés elrejtése ▴' : 'Kérdés megnézése ▾'}
          </span>
          {open && (
            <p className="mt-1 whitespace-pre-line text-ritual-gray border-l-2 border-ritual-purple pl-2">
              {opt.task_prompt}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function RitualSubmit({ profile }) {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState({}) // ingredient_id -> inventory row id
  const [openQ, setOpenQ] = useState({}) // inventory row id -> lenyitott kérdés
  const [config, setConfig] = useState(null)
  const [gate, setGate] = useState(null)
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
      const { data: gt } = await supabase.rpc('get_ritual_gate')
      setGate((gt ?? [])[0] ?? null)
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
  const gatherEnd = config?.ends_at ? new Date(config.ends_at).getTime() : null
  // Beküldési kapu: mind a rendes állomás kész, vagy lejárt a gyűjtési idő
  // (a szerver is ellenőrzi; a helyi óra másodpercenként élesíti a gombot)
  const gatherOver = !!gate?.gather_over || (gatherEnd != null && Date.now() > gatherEnd)
  const gateOpen = !gate || gate.can_submit || gatherOver

  async function handleSubmit() {
    const ok = await confirm({
      title: 'Beküldöd a rituálét?',
      message:
        'Beküldés után már nem módosítható.' +
        (missingCount > 0
          ? `\n\nMég ${missingCount} alapanyag hiányzik, ezért hiányos rituálé lesz.`
          : ''),
      confirmText: 'Igen, beküldöm',
      cancelText: 'Még átgondolom'
    })
    if (!ok) return
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
    // A beküldött hozzávalók lassan keringenek az üst körül — a csapat látja,
    // hogy elment a rituálé, de az eredményről még semmit nem tud.
    const sent = INGREDIENTS.filter((ing) => Object.values(grouped).some((g) => g.name === ing.name))
    return (
      <div className="min-h-screen grid place-items-center bg-ritual-black px-6 text-center safe-top safe-bottom">
        <div>
          <div className="relative mx-auto mb-8" style={{ width: 'min(72vw, 280px)', height: 'min(72vw, 280px)' }}>
            <div
              className="absolute inset-[-20%] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(122,63,181,.35) 0%, transparent 65%)' }}
            />
            <div className="absolute inset-0 rs-ring-spin">
              {sent.map((ing) => {
                const slot = INGREDIENTS.findIndex((x) => x.slug === ing.slug)
                const a = ((-90 + slot * 60) * Math.PI) / 180
                return (
                  <div
                    key={ing.slug}
                    className="absolute"
                    style={{
                      left: `${50 + 38 * Math.cos(a)}%`,
                      top: `${50 + 38 * Math.sin(a)}%`,
                      width: '22%',
                      height: '22%',
                      marginLeft: '-11%',
                      marginTop: '-11%'
                    }}
                  >
                    <div className="rs-ring-counter w-full h-full">
                      <IngredientIcon slug={ing.slug} size="100%" />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="absolute" style={{ left: '50%', top: '50%', width: '40%', height: '46%', marginLeft: '-20%', marginTop: '-23%' }}>
              <Cauldron brew="#4b3470" phase="pour" glow={false} />
            </div>
          </div>
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
      {gate && !gateOpen && (
        <div className="bg-ritual-purpleDark border border-ritual-orange rounded-xl p-3 mb-4 text-sm">
          <p className="text-ritual-bone">
            Még nem küldhetitek be: rendes állomások{' '}
            <span className="font-semibold text-ritual-orange">
              {gate.primary_done}/{gate.primary_total}
            </span>
            .
          </p>
          <p className="text-ritual-gray mt-1">
            A beküldés akkor nyílik meg, ha mindet végigjártátok, vagy ha lejár a gyűjtési idő
            {gatherEnd != null && Date.now() < gatherEnd && (
              <> (még {formatClock(gatherEnd - Date.now())})</>
            )}
            .
          </p>
        </div>
      )}
      {missingCount > 0 && (
        <p className="text-monster-vampire text-sm mb-4">
          {missingCount} alapanyag még hiányzik — beküldhető, de hiányos rituálé lesz belőle.
        </p>
      )}

      <div className="space-y-4 mb-8">
        {Object.entries(grouped).map(([ingredientId, group]) => (
          <div key={ingredientId} className="bg-ritual-purpleDark rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <IngredientIcon name={group.name} size={40} />
              <p className="font-semibold text-ritual-bone">{group.name}</p>
            </div>
            {group.options.length === 1 ? (
              <div>
                <p className="text-ritual-gray text-sm">Egy példányotok van — ez kerül be.</p>
                <div className="mt-1 text-ritual-gray">
                  <CopyInfo
                    opt={group.options[0]}
                    open={!!openQ[group.options[0].id]}
                    onToggle={() => setOpenQ((o) => ({ ...o, [group.options[0].id]: !o[group.options[0].id] }))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {group.options.map((opt, i) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelected((s) => ({ ...s, [ingredientId]: opt.id }))}
                    className={`w-full text-left rounded-lg px-3 py-2 border ${
                      selected[ingredientId] === opt.id
                        ? 'border-ritual-orange text-ritual-orange'
                        : 'border-ritual-purple text-ritual-gray'
                    }`}
                  >
                    <span className="block text-sm">
                      {i + 1}. példány ({opt.room_name})
                      {selected[ingredientId] === opt.id && ' ✓'}
                    </span>
                    <div className="mt-0.5">
                      <CopyInfo
                        opt={opt}
                        open={!!openQ[opt.id]}
                        onToggle={() => setOpenQ((o) => ({ ...o, [opt.id]: !o[opt.id] }))}
                      />
                    </div>
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
        disabled={submitting || rows.length === 0 || !gateOpen}
        className="w-full rounded-xl px-4 py-4 bg-ritual-red text-ritual-bone font-semibold disabled:opacity-50"
      >
        {submitting ? 'Küldés…' : gateOpen ? 'Rituálé beküldése' : 'Még nem küldhető be'}
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
