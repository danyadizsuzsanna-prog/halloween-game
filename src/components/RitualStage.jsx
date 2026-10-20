import { useEffect, useMemo, useRef, useState } from 'react'
import IngredientIcon, { INGREDIENTS } from './IngredientIcon'
import { Vampire, Bat, Ghost, Werewolf, Seal } from './Creatures'
import { imgUrl, LAYOUT_NOW as LAY } from '../lib/images'

// Egy csapat rituáléjának lejátszása a kivetítőn.
//
//   ready  → a hat hely a gyűrűben, az üst vár
//   pour   → a hozzávalók sorban az üstbe hullanak
//   flash  → villanás
//   reveal → végkifejlet (siker / szörny / nem sikerült)
//
// A szörny neve és a siker/kudarc eredménye csak a "reveal" fázisban jelenik
// meg — addig minden csapatnál ugyanúgy néz ki a lejátszás.

export const OUTCOMES = {
  success: {
    color: '#f0b45a',
    brew: '#f0b45a',
    title: 'A rituálé sikerült!',
    sub: 'A fény visszaűzi a szellemeket — az iroda biztonságban.'
  },
  vampire: {
    color: '#d1334b',
    brew: '#8f1226',
    title: 'Vámpírok törtek be!',
    sub: 'Valami besurrant a főzetbe… és most éhes.'
  },
  ghost: {
    color: '#a9c1e0',
    brew: '#5f7396',
    title: 'Szellemek szabadultak el!',
    sub: 'A halottak suttogása betölti az irodát…'
  },
  werewolf: {
    color: '#8fb86a',
    brew: '#4d6b35',
    title: 'Vérfarkasok érkeztek!',
    sub: 'Telihold van, és nincs hová menekülni.'
  },
  incomplete: {
    color: '#8a8294',
    brew: '#3a3442',
    title: 'Ez most sajnos nem sikerült',
    sub: 'A főzet nem állt össze — a sötétség egyelőre kivár.'
  }
}

export function outcomeKey(sub) {
  if (!sub.is_complete) return 'incomplete'
  if (sub.final_monster) return sub.final_monster
  return 'success'
}

const START_DELAY = 0.8 // s: ennyi után indul az első hozzávaló
const STEP = 0.9 // s: két hozzávaló indulása között
const FLY = 1.1 // s: egy hozzávaló útja az üstig

function slotPos(i) {
  const a = ((-90 + i * 60) * Math.PI) / 180
  return { x: 50 + 39 * Math.cos(a), y: 48 + 39 * Math.sin(a) }
}

function CountUp({ to, ms = 1600, delay = 700 }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    let t0
    const timer = setTimeout(() => {
      const tick = (t) => {
        if (t0 == null) t0 = t
        const p = Math.min(1, (t - t0) / ms)
        setV(Math.round(to * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [to, ms, delay])
  return <>{v}</>
}

function CauldronSvg({ brew, phase, flamesOnly = false }) {
  return (
    <svg viewBox="0 0 200 170" className="w-full h-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="cd-iron" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b090e" />
          <stop offset=".3" stopColor="#3a3541" />
          <stop offset=".55" stopColor="#1a161e" />
          <stop offset="1" stopColor="#07060a" />
        </linearGradient>
        <linearGradient id="cd-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#25212b" />
          <stop offset=".4" stopColor="#6d6677" />
          <stop offset="1" stopColor="#1b1820" />
        </linearGradient>
        <radialGradient id="cd-brew" cx=".5" cy=".5" r=".6">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".5" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cd-fireglow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ff9a3a" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff9a3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cd-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff5a1a" />
          <stop offset=".6" stopColor="#ffb02e" />
          <stop offset="1" stopColor="#fff2b8" />
        </linearGradient>
      </defs>
      {/* fény a tűz körül */}
      <ellipse cx="100" cy="158" rx="92" ry="26" fill="url(#cd-fireglow)" className="rs-flicker" />
      {/* tűz */}
      <g className="rs-fire">
        <path d="M62 170 C52 150 70 142 66 124 C82 138 88 154 80 170 Z" fill="url(#cd-flame)" opacity=".9" />
        <path d="M100 170 C86 144 110 136 104 112 C124 130 128 152 114 170 Z" fill="url(#cd-flame)" />
        <path d="M138 170 C130 152 144 146 140 128 C154 142 154 158 146 170 Z" fill="url(#cd-flame)" opacity=".9" />
        <path d="M100 170 C95 156 105 150 102 138 C112 148 112 160 106 170 Z" fill="#fff6d0" />
      </g>
      {!flamesOnly && (
        <>
      {/* fogantyúk és lábak */}
      <path d="M32 62 C12 62 10 92 34 96" stroke="#2a2630" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M168 62 C188 62 190 92 166 96" stroke="#2a2630" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M32 62 C14 62 12 90 34 94" stroke="#5a5463" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".7" />
      <path d="M58 132 L46 154 M142 132 L154 154" stroke="#0e0b12" strokeWidth="10" strokeLinecap="round" />
      {/* test */}
      <path
        d="M22 56 C12 110 40 148 100 150 C160 148 188 110 178 56 Z"
        fill="url(#cd-iron)"
        stroke="#4a4452"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M36 80 C36 114 54 136 82 144" stroke="#8a8394" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".35" />
      {/* pattogzások, rozsda-foltok */}
      <g stroke="#0a080d" strokeWidth="1.2" fill="none" opacity=".8">
        <path d="M120 100 l6 8 l-3 6 M70 112 l-5 7 M150 88 l5 5" />
      </g>
      <g fill="#6b3a1e" opacity=".35">
        <ellipse cx="146" cy="116" rx="9" ry="4" />
        <ellipse cx="58" cy="100" rx="6" ry="3" />
      </g>
      <g fill="#6d6677">
        <circle cx="46" cy="70" r="2.2" />
        <circle cx="154" cy="70" r="2.2" />
        <circle cx="100" cy="78" r="2.2" />
      </g>
      {/* perem + főzet */}
      <ellipse cx="100" cy="56" rx="78" ry="18" fill="url(#cd-rim)" stroke="#8a8394" strokeWidth="1.4" />
      <ellipse cx="100" cy="57" rx="68" ry="13" className="rs-brew" style={{ fill: brew }} />
      <ellipse cx="100" cy="57" rx="68" ry="13" fill="url(#cd-brew)" />
      <ellipse cx="100" cy="57" rx="68" ry="13" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="1.5" />
      {/* buborékok */}
      <g fill="#fff" fillOpacity=".55">
        <circle cx="78" cy="57" r="3.4" className="rs-bubble" style={{ '--bd': '0s' }} />
        <circle cx="112" cy="58" r="2.6" className="rs-bubble" style={{ '--bd': '.7s' }} />
        <circle cx="96" cy="55" r="2" className="rs-bubble" style={{ '--bd': '1.3s' }} />
        <circle cx="128" cy="56" r="3" className="rs-bubble" style={{ '--bd': '.35s' }} />
      </g>
      {phase === 'ready' && <ellipse cx="100" cy="57" rx="68" ry="13" fill="#7a3fb5" opacity=".15" />}
        </>
      )}
    </svg>
  )
}

// Az üst: kép (public/img/uszt.webp) — a képen a láng és a gőz is rajta van.
// Ha a kép nem tölt be, a vektoros rajz lép a helyére.
export function Cauldron({ brew, phase, glow = true }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <CauldronSvg brew={brew} phase={phase} />
  return (
    <div className="relative w-full h-full">
      <img
        src={imgUrl('uszt')}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain"
        onError={() => setFailed(true)}
      />
      {/* a főzet derengése a peremen — az eredmény színében */}
      {glow && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${LAY.glow.left}%`,
            top: `${LAY.glow.top}%`,
            width: `${LAY.glow.width}%`,
            height: `${LAY.glow.height}%`,
            background: `radial-gradient(ellipse, ${phase === 'ready' ? '#7a3fb5' : brew} 0%, transparent 70%)`,
            mixBlendMode: 'screen',
            opacity: 0.7
          }}
        />
      )}
    </div>
  )
}

function Smoke() {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div className="rs-smoke w-[70%] h-[70%] rounded-full" style={{ background: 'radial-gradient(circle, #8a8294 0%, transparent 65%)' }} />
  }
  return (
    <img
      src={imgUrl('fust')}
      alt=""
      draggable={false}
      className="rs-smoke w-[80%] h-[80%] object-contain"
      style={{ filter: LAY.smokeFilter }}
      onError={() => setFailed(true)}
    />
  )
}

export default function RitualStage({ submission, play = false, onPhase }) {
  const [phase, setPhase] = useState('ready')
  const onPhaseRef = useRef(onPhase)
  onPhaseRef.current = onPhase

  const key = outcomeKey(submission)
  const out = OUTCOMES[key]

  // Mely hozzávalók vannak a rituáléban? Ha a szerver nem adott részletet
  // (pl. a 0004 migráció még nincs lefuttatva), a teljes rituálé = mind a hat.
  const presentSlugs = useMemo(() => {
    if (Array.isArray(submission.ingredients)) return new Set(submission.ingredients.map((i) => i.slug))
    return new Set(submission.is_complete ? INGREDIENTS.map((i) => i.slug) : [])
  }, [submission])
  const freshBySlug = useMemo(() => {
    const m = {}
    if (Array.isArray(submission.ingredients)) submission.ingredients.forEach((i) => (m[i.slug] = i.freshness))
    return m
  }, [submission])

  const order = INGREDIENTS.map((ing, slot) => ({ ...ing, slot })).filter((ing) => presentSlugs.has(ing.slug))
  const missing = INGREDIENTS.filter((ing) => !presentSlugs.has(ing.slug))
  const n = order.length
  const landedAt = START_DELAY + Math.max(0, n - 1) * STEP + FLY * 0.85

  useEffect(() => {
    onPhaseRef.current?.(phase)
  }, [phase])

  useEffect(() => {
    if (!play) return
    setPhase('pour')
    const t1 = setTimeout(() => setPhase('flash'), (landedAt + 0.5) * 1000)
    const t2 = setTimeout(() => setPhase('reveal'), (landedAt + 0.95) * 1000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [play, landedAt])

  const revealed = phase === 'reveal'
  const brew = revealed ? out.brew : '#4b3470'
  const power = Math.round(Number(submission.freshness_score ?? 0) * 100)

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-start select-none overflow-hidden">
      {/* atmoszféra: köd, parázs, vignetta, szemcsézettség */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="rs-fog absolute rounded-full" style={{ left: '-20%', top: '55%', width: '80%', height: '45%', '--fd': '0s' }} />
        <div className="rs-fog absolute rounded-full" style={{ left: '40%', top: '65%', width: '80%', height: '40%', '--fd': '-9s' }} />
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="rs-ember absolute rounded-full"
            style={{ left: `${40 + ((i * 37) % 21)}%`, top: `${60 + ((i * 13) % 14)}%`, '--ed': `${(i * 0.7) % 5}s`, '--ex': `${((i * 53) % 40) - 20}px` }}
          />
        ))}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.85) 100%)' }} />
        <div className="rs-grain absolute inset-0" />
        {revealed && (
          <div
            className="rs-throb absolute inset-0"
            style={{ boxShadow: `inset 0 0 20vh ${out.color}66` }}
          />
        )}
      </div>
      <p className="font-display text-ritual-bone text-[4.2vh] leading-none mt-[2.5vh] mb-[1.5vh] text-center px-6">
        {submission.team_name}
      </p>

      <div className="relative" style={{ width: 'min(61vh, 90vw)', height: 'min(61vh, 90vw)' }}>
        {/* kiszínezett háttér-derengés a végkifejletnél */}
        <div
          className="absolute -inset-[30%] rounded-full pointer-events-none transition-opacity duration-1000"
          style={{
            opacity: revealed ? 0.55 : phase === 'ready' ? 0.12 : 0.22,
            background: `radial-gradient(circle, ${revealed ? out.color : '#7a3fb5'} 0%, transparent 62%)`
          }}
        />

        {/* sugarak sikernél */}
        {revealed && key === 'success' && (
          <svg viewBox="0 0 200 200" className="absolute inset-[-12%] w-[124%] h-[124%] rs-rays" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <polygon key={i} points="100,100 94,0 106,0" fill="#e8a24a" fillOpacity=".28" transform={`rotate(${i * 30} 100 100)`} />
            ))}
          </svg>
        )}

        {/* üres helyek (halvány gyűrű) */}
        {INGREDIENTS.map((ing, i) => {
          const p = slotPos(i)
          const isMissing = !presentSlugs.has(ing.slug)
          return (
            <div
              key={`slot-${ing.slug}`}
              className="absolute rounded-full border-2 border-dashed border-ritual-purple/70"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: '18%',
                height: '18%',
                transform: 'translate(-50%,-50%)',
                opacity: revealed ? 0 : 1,
                transition: 'opacity .6s'
              }}
            >
              {isMissing && (
                <span className="absolute inset-0 grid place-items-center text-ritual-gray/70 font-display text-[3vh]">?</span>
              )}
            </div>
          )
        })}

        {/* üst */}
        <div
          className={`absolute ${phase === 'flash' ? 'rs-cauldron-shake' : ''}`}
          style={{
            left: '50%',
            top: revealed ? '82%' : '55%',
            width: `${LAY.cauldron.w}%`,
            height: `${LAY.cauldron.h}%`,
            marginLeft: `-${LAY.cauldron.w / 2}%`,
            marginTop: `-${LAY.cauldron.h / 2}%`,
            transform: revealed ? 'scale(.78)' : 'scale(1)',
            transition: 'top .9s cubic-bezier(.3,.7,.3,1), transform .9s cubic-bezier(.3,.7,.3,1)'
          }}
        >
          <Cauldron brew={brew} phase={phase} />
        </div>

        {/* gőz (csak a végkifejletnél, az eredmény színében) */}
        {revealed && [0, 1, 2].map((i) => (
          <span
            key={i}
            className="rs-steam absolute rounded-full"
            style={{
              left: `${44 + i * 6}%`,
              top: revealed ? '68%' : `${LAY.landingTop - 7}%`,
              width: '6%',
              height: '6%',
              marginLeft: '-3%',
              background: revealed ? out.color : '#b9a6d9',
              '--sd': `${i * 0.9}s`
            }}
          />
        ))}

        {/* hozzávalók */}
        {order.map((ing, k) => {
          const p = slotPos(ing.slot)
          const stale = freshBySlug[ing.slug] === 'stale'
          const flying = phase !== 'ready'
          const d = START_DELAY + k * STEP
          return (
            <div
              key={ing.slug}
              className={`absolute ${flying ? 'rs-fly' : 'rs-idle'}`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: '18%',
                height: '18%',
                marginLeft: '-9%',
                marginTop: '-9%',
                '--x': `${p.x}%`,
                '--y': `${p.y}%`,
                '--d': `${d}s`,
                '--fly': `${FLY}s`,
                '--ty': `${LAY.landingTop}%`,
                '--i': k
              }}
            >
              <div className={flying ? 'rs-lift' : ''} style={{ width: '100%', height: '100%', opacity: stale ? 0.78 : 1 }}>
                <IngredientIcon slug={ing.slug} size="100%" />
              </div>
            </div>
          )
        })}

        {/* csobbanás-gyűrűk, amikor egy hozzávaló beér */}
        {phase !== 'ready' &&
          order.map((ing, k) => (
            <span
              key={`rp-${ing.slug}`}
              className="rs-ripple absolute rounded-full"
              style={{
                left: '50%',
                top: `${LAY.landingTop - 1}%`,
                width: '22%',
                height: '7%',
                marginLeft: '-11%',
                marginTop: '-3.5%',
                borderColor: '#d9c7ff',
                '--rd': `${START_DELAY + k * STEP + FLY * 0.85}s`
              }}
            />
          ))}

        {/* villám */}
        {phase === 'flash' && (
          <svg viewBox="0 0 100 100" className="rs-bolt absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
            <polyline points="56,0 44,22 54,26 38,50 49,53 34,78" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            <polyline points="56,0 44,22 54,26 38,50 49,53 34,78" fill="none" stroke="#bcd4ff" strokeWidth="4" strokeLinejoin="round" opacity=".5" />
          </svg>
        )}

        {/* villanás */}
        {phase === 'flash' && (
          <div
            className="rs-flash absolute rounded-full pointer-events-none"
            style={{ left: '50%', top: `${LAY.landingTop}%`, width: '150%', height: '150%', transform: 'translate(-50%,-50%)' }}
          />
        )}

        {/* végkifejlet-alak */}
        {revealed && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="rs-rise absolute"
              style={{ left: '50%', top: '36%', width: '68%', height: '68%', marginLeft: '-34%', marginTop: '-34%' }}
            >
              {key === 'success' && <Seal className="w-full h-full rs-spin" />}
              {key === 'vampire' && (
                <>
                  <Vampire className="w-full h-full rs-float" style={{ filter: 'drop-shadow(0 0 3vh #d1334b)' }} />
                  <Bat className="absolute rs-orbit" style={{ width: '24%', left: '-6%', top: '2%', '--od': '.2s' }} />
                  <Bat className="absolute rs-orbit" style={{ width: '20%', right: '-4%', top: '18%', '--od': '.9s' }} />
                  <Bat className="absolute rs-orbit" style={{ width: '16%', left: '12%', bottom: '4%', '--od': '1.5s' }} />
                </>
              )}
              {key === 'ghost' && (
                <Ghost className="w-full h-full rs-float" style={{ filter: 'drop-shadow(0 0 3vh #a9c1e0)' }} />
              )}
              {key === 'werewolf' && (
                <Werewolf className="w-full h-full rs-float" style={{ filter: 'drop-shadow(0 0 3vh #8fb86a)' }} />
              )}
              {key === 'incomplete' && (
                <div className="w-full h-full grid place-items-center">
                  <Smoke />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* felirat */}
      <div className="mt-[1.5vh] text-center px-8 min-h-[16vh] pb-[7vh]">
        {revealed && (
          <>
            <p
              className="rs-title font-display text-[6.2vh] leading-tight"
              style={{ color: out.color, textShadow: `0 0 3vh ${out.color}99, 0 .3vh 0 #000` }}
            >
              {out.title}
            </p>
            <p className="rs-sub text-ritual-bone/85 text-[2.8vh] mt-[1vh]">
              {key === 'incomplete' && missing.length > 0 && missing.length < 6
                ? `Hiányzott: ${missing.map((m) => m.name).join(', ')}.`
                : out.sub}
            </p>
            {key === 'success' && (
              <p className="rs-sub text-ritual-orange text-[3.4vh] mt-[1vh]" style={{ '--sdl': '1.4s' }}>
                A rituálé ereje: <span className="font-display text-[4.4vh]"><CountUp to={power} />%</span>
              </p>
            )}
          </>
        )}
        {!revealed && phase === 'ready' && <p className="text-ritual-gray text-[2.6vh]">A rituálé készen áll…</p>}
        {!revealed && phase === 'pour' && <p className="text-ritual-gray text-[2.6vh] rs-pulse">A főzet készül…</p>}
      </div>
    </div>
  )
}
