// A rituálé végkifejletének alakjai — sötét, árnyékolt, komor megjelenéssel.
// Mind saját rajz (nem ismert karakter). Gradiensek, fény-effektek és enyhe
// textúra adja a "festett" hatást; a szűrők azonosítói fixek, mert minden
// példány ugyanazt a definíciót használja.

import { useState } from 'react'

import { imgUrl } from '../lib/images'

// Kép (public/img/<file>.webp), ha betölt; különben a vektoros tartalék.
function withImage(Svg, file, alt) {
  return function Creature({ className = '', style }) {
    const [failed, setFailed] = useState(false)
    if (failed) return <Svg className={className} style={style} />
    return (
      <img
        src={imgUrl(file)}
        alt={alt}
        draggable={false}
        className={className}
        style={{ objectFit: 'contain', ...style }}
        onError={() => setFailed(true)}
      />
    )
  }
}

const Defs = () => (
  <defs>
    <filter id="cr-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="cr-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.2" />
    </filter>
    <filter id="cr-rough" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="7" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" />
    </filter>
  </defs>
)

// ---------------------------------------------------------------- VÁMPÍR
function VampireSvg({ className = '', style }) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} role="img" aria-label="Vámpír">
      <Defs />
      <defs>
        <linearGradient id="vp-skin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6f6a63" />
          <stop offset=".35" stopColor="#d6d0c2" />
          <stop offset=".65" stopColor="#c4bdae" />
          <stop offset="1" stopColor="#5a554f" />
        </linearGradient>
        <linearGradient id="vp-cape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a1020" />
          <stop offset=".55" stopColor="#1c0509" />
          <stop offset="1" stopColor="#0b0306" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="vp-eye" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffd0d0" />
          <stop offset=".35" stopColor="#ff2a3d" />
          <stop offset="1" stopColor="#7a0a18" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* magas gallér / köpeny */}
      <g filter="url(#cr-rough)">
        <path d="M6 200 L18 84 L70 134 L100 200 Z" fill="url(#vp-cape)" />
        <path d="M194 200 L182 84 L130 134 L100 200 Z" fill="url(#vp-cape)" />
        <path d="M70 134 L100 200 L130 134 L100 150 Z" fill="url(#vp-cape)" />
        <path d="M18 84 L70 134 M182 84 L130 134 M18 84 L6 150 M182 84 L194 150" stroke="#b83048" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
      {/* nyak */}
      <path d="M84 128 L84 160 L100 172 L116 160 L116 128 Z" fill="#8b857a" />
      {/* fej */}
      <path
        d="M100 20 C70 20 60 54 64 88 C66 112 82 134 100 144 C118 134 134 112 136 88 C140 54 130 20 100 20 Z"
        fill="url(#vp-skin)"
      />
      {/* beesett orcák, árnyékok */}
      <path d="M68 92 C72 112 84 128 98 138 C80 128 70 112 68 92 Z" fill="#2a2420" opacity=".55" filter="url(#cr-soft)" />
      <path d="M132 92 C128 112 116 128 102 138 C120 128 130 112 132 92 Z" fill="#2a2420" opacity=".55" filter="url(#cr-soft)" />
      {/* haj */}
      <path
        d="M62 76 C58 36 76 12 100 12 C124 12 142 36 138 76 C132 56 118 46 100 62 C82 46 68 56 62 76 Z"
        fill="#0b080e"
      />
      <path d="M78 24 C86 16 94 14 100 16" stroke="#3a3040" strokeWidth="2" fill="none" opacity=".7" />
      {/* szemgödrök */}
      <ellipse cx="84" cy="88" rx="12" ry="7" fill="#1a0a14" opacity=".85" filter="url(#cr-soft)" />
      <ellipse cx="116" cy="88" rx="12" ry="7" fill="#1a0a14" opacity=".85" filter="url(#cr-soft)" />
      {/* szemöldök */}
      <path d="M70 78 L96 86 L94 90 L72 83 Z" fill="#0b080e" />
      <path d="M130 78 L104 86 L106 90 L128 83 Z" fill="#0b080e" />
      {/* izzó vörös szemek */}
      <g filter="url(#cr-glow)">
        <ellipse cx="85" cy="90" rx="8" ry="4.5" fill="url(#vp-eye)" />
        <ellipse cx="115" cy="90" rx="8" ry="4.5" fill="url(#vp-eye)" />
      </g>
      <ellipse cx="85" cy="90" rx="1.4" ry="3.6" fill="#1a0004" />
      <ellipse cx="115" cy="90" rx="1.4" ry="3.6" fill="#1a0004" />
      {/* orr */}
      <path d="M100 92 L96 112 Q100 116 104 112 Z" fill="#8f897e" opacity=".6" />
      {/* száj + agyarak */}
      <path d="M80 120 Q100 112 120 120 Q100 138 80 120 Z" fill="#240609" />
      <path d="M80 120 Q100 112 120 120" stroke="#6a1a22" strokeWidth="2" fill="none" />
      <path d="M86 119 L90 138 L95 121 Z" fill="#f4f0e6" stroke="#8a8478" strokeWidth=".6" />
      <path d="M114 119 L110 138 L105 121 Z" fill="#f4f0e6" stroke="#8a8478" strokeWidth=".6" />
      <path d="M96 123 L98 128 L100 123 Z M100 123 L102 128 L104 123 Z" fill="#e9e4d8" opacity=".9" />
      {/* vércsepp */}
      <path d="M90 138 C88 144 87 148 90 150 C93 148 92 144 90 138 Z" fill="#b3122a" />
      <path d="M90 150 L90 164" stroke="#8a0c20" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
    </svg>
  )
}

// Kis denevér — a vámpír körül köröz
export function Bat({ className = '', style }) {
  const wing =
    'M112 66 C130 40 165 34 192 48 C184 54 182 64 174 68 C170 62 160 62 156 72 C150 64 140 66 136 78 C128 72 120 76 114 90 Z'
  return (
    <svg viewBox="0 0 200 130" className={className} style={style} role="img" aria-label="Denevér">
      <g fill="#0a0306" stroke="#7a1a2a" strokeWidth="2" strokeLinejoin="round">
        <path d={wing} />
        <path d={wing} transform="translate(200 0) scale(-1 1)" />
        <ellipse cx="100" cy="78" rx="13" ry="25" />
        <circle cx="100" cy="52" r="12" />
        <path d="M90 46 L87 26 L99 40 Z" />
        <path d="M110 46 L113 26 L101 40 Z" />
      </g>
      <g fill="#ff3a4d">
        <circle cx="95" cy="52" r="2.2" />
        <circle cx="105" cy="52" r="2.2" />
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------- SZELLEM
function GhostSvg({ className = '', style }) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} role="img" aria-label="Szellem">
      <Defs />
      <defs>
        <linearGradient id="gh-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfeaff" stopOpacity=".92" />
          <stop offset=".55" stopColor="#8ea3c4" stopOpacity=".6" />
          <stop offset="1" stopColor="#4d5c7c" stopOpacity=".18" />
        </linearGradient>
        <radialGradient id="gh-mouth" cx=".5" cy=".3" r=".8">
          <stop offset="0" stopColor="#000" />
          <stop offset="1" stopColor="#0a0e18" />
        </radialGradient>
      </defs>
      {/* karok */}
      <g fill="none" stroke="url(#gh-body)" strokeLinecap="round" filter="url(#cr-soft)" opacity=".8">
        <path d="M54 92 C34 104 22 128 16 164" strokeWidth="11" />
        <path d="M146 92 C166 104 178 128 184 164" strokeWidth="11" />
      </g>
      {/* test: csuklya, szakadozott alj */}
      <g filter="url(#cr-glow)">
        <path
          d="M100 14 C70 14 52 40 52 78 C52 104 44 132 36 176
             C46 168 52 160 58 150 C60 166 56 182 54 196
             C66 184 72 168 76 152 C80 170 82 188 82 200
             C92 186 96 170 98 154 C102 172 106 188 112 200
             C116 184 120 168 122 150 C128 166 134 182 146 192
             C144 178 140 164 142 148 C150 158 158 166 164 172
             C156 140 148 108 148 78 C148 40 130 14 100 14 Z"
          fill="url(#gh-body)"
        />
      </g>
      {/* belső árnyék */}
      <path d="M120 22 C142 36 148 58 148 80 C148 104 150 126 158 160 C140 120 130 70 120 22 Z" fill="#5b6a88" opacity=".35" />
      {/* üreges szemek, tátott száj */}
      <path d="M80 50 C66 54 64 86 74 106 C79 116 86 108 90 86 C92 66 90 50 80 50 Z" fill="#03050a" />
      <path d="M120 50 C134 54 136 86 126 106 C121 116 114 108 110 86 C108 66 110 50 120 50 Z" fill="#03050a" />
      <path d="M78 100 C77 124 80 140 78 156 M122 100 C123 124 120 140 122 156" stroke="#03050a" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".45" filter="url(#cr-soft)" />
      <ellipse cx="82" cy="70" rx="2.6" ry="5" fill="#9fc4ff" opacity=".4" />
      <ellipse cx="118" cy="70" rx="2.6" ry="5" fill="#9fc4ff" opacity=".4" />
      <path d="M100 100 C90 104 88 128 92 150 C95 162 105 162 108 150 C112 128 110 104 100 100 Z" fill="url(#gh-mouth)" />
    </svg>
  )
}

// ---------------------------------------------------------------- VÉRFARKAS
function WerewolfSvg({ className = '', style }) {
  // szőr-szálak a fej körvonala mentén
  const fur = []
  for (let i = 0; i < 46; i++) {
    const a = (Math.PI * 2 * i) / 46
    const rx = 52 + ((i * 7) % 9)
    const ry = 62 + ((i * 5) % 11)
    const x = 100 + rx * Math.cos(a)
    const y = 104 + ry * Math.sin(a)
    const x2 = 100 + (rx - 16) * Math.cos(a + 0.12)
    const y2 = 104 + (ry - 18) * Math.sin(a + 0.12)
    fur.push(`M${x.toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`)
  }
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} role="img" aria-label="Vérfarkas">
      <Defs />
      <defs>
        <radialGradient id="ww-moon" cx=".4" cy=".35" r=".75">
          <stop offset="0" stopColor="#fbf6e0" />
          <stop offset=".7" stopColor="#c9c3a4" />
          <stop offset="1" stopColor="#8f8a70" />
        </radialGradient>
        <linearGradient id="ww-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4030" />
          <stop offset="1" stopColor="#0f120b" />
        </linearGradient>
        <linearGradient id="ww-muzzle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#59604a" />
          <stop offset="1" stopColor="#262a1d" />
        </linearGradient>
        <radialGradient id="ww-eye" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".45" stopColor="#ffb21a" />
          <stop offset="1" stopColor="#a65a00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ww-mouth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a0a10" />
          <stop offset="1" stopColor="#8a1420" />
        </linearGradient>
      </defs>
      {/* telihold */}
      <circle cx="100" cy="100" r="92" fill="url(#ww-moon)" opacity=".95" />
      <g fill="#8f8a70" opacity=".35">
        <circle cx="52" cy="58" r="12" />
        <circle cx="150" cy="140" r="15" />
        <circle cx="40" cy="132" r="8" />
        <circle cx="156" cy="52" r="7" />
      </g>
      {/* fej */}
      <g filter="url(#cr-rough)">
        <path
          d="M100 24 L110 42 L130 18 L138 58 L158 54 L148 82 L166 102 L148 114 L154 142 L130 142 L124 170 L100 186 L76 170 L70 142 L46 142 L52 114 L34 102 L52 82 L42 54 L62 58 L70 18 L90 42 Z"
          fill="url(#ww-fur)"
          stroke="#7a8660"
          strokeWidth="1.5"
        />
      </g>
      <path d={fur.join(' ')} stroke="#6f7a56" strokeWidth="1.1" opacity=".55" strokeLinecap="round" />
      {/* belső fül */}
      <path d="M72 30 L84 52 L66 58 Z" fill="#5a2a2a" opacity=".7" />
      <path d="M128 30 L116 52 L134 58 Z" fill="#5a2a2a" opacity=".7" />
      {/* orrnyereg + pofa */}
      <path d="M78 112 C80 94 120 94 122 112 L128 142 C116 156 84 156 72 142 Z" fill="url(#ww-muzzle)" />
      <path d="M86 108 L80 96 M114 108 L120 96 M92 104 L100 96 L108 104" stroke="#14170e" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* nyitott, vicsorgó száj */}
      <path d="M78 140 Q100 176 122 140 Q100 150 78 140 Z" fill="url(#ww-mouth)" />
      <path d="M80 141 L84 160 L90 144 Z M89 145 L94 156 L98 147 Z M102 147 L106 156 L111 145 Z M110 144 L116 160 L120 141 Z" fill="#f2eedd" stroke="#8a8670" strokeWidth=".6" />
      <path d="M88 158 L92 150 L96 160 M104 160 L108 150 L112 158" fill="#e6e2d0" stroke="#8a8670" strokeWidth=".5" />
      {/* orr */}
      <path d="M90 112 Q100 104 110 112 Q108 122 100 122 Q92 122 90 112 Z" fill="#050604" />
      <ellipse cx="97" cy="110" rx="3" ry="1.6" fill="#8a8f80" opacity=".6" />
      {/* szemek */}
      <g filter="url(#cr-glow)">
        <path d="M58 84 L90 94 L86 106 L56 96 Z" fill="url(#ww-eye)" />
        <path d="M142 84 L110 94 L114 106 L144 96 Z" fill="url(#ww-eye)" />
      </g>
      <rect x="73" y="91" width="2.6" height="12" rx="1.3" fill="#120800" transform="rotate(-18 74 97)" />
      <rect x="125" y="91" width="2.6" height="12" rx="1.3" fill="#120800" transform="rotate(18 126 97)" />
      {/* dühös szemöldök */}
      <path d="M52 78 L92 90 L92 82 L58 68 Z" fill="#0c0f08" />
      <path d="M148 78 L108 90 L108 82 L142 68 Z" fill="#0c0f08" />
    </svg>
  )
}

// ---------------------------------------------------------------- PECSÉT
// Sikeres rituálé: izzó védő-pecsét (pentagram + rúnagyűrű).
function SealSvg({ className = '', style }) {
  const star = []
  for (let i = 0; i < 5; i++) {
    const a = ((i * 144 - 90) * Math.PI) / 180
    star.push(`${(100 + 62 * Math.cos(a)).toFixed(1)},${(100 + 62 * Math.sin(a)).toFixed(1)}`)
  }
  const ticks = []
  for (let i = 0; i < 48; i++) {
    const a = (Math.PI * 2 * i) / 48
    const r1 = 84
    const r2 = i % 4 === 0 ? 76 : 80
    ticks.push(
      `M${(100 + r1 * Math.cos(a)).toFixed(1)} ${(100 + r1 * Math.sin(a)).toFixed(1)} L${(100 + r2 * Math.cos(a)).toFixed(1)} ${(100 + r2 * Math.sin(a)).toFixed(1)}`
    )
  }
  const runes = []
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12
    const cx = 100 + 70 * Math.cos(a)
    const cy = 100 + 70 * Math.sin(a)
    const rot = (a * 180) / Math.PI + 90
    const v = i % 3
    runes.push(
      <path
        key={i}
        d={v === 0 ? 'M0 -4 L0 4 M-2.5 -1 L0 -4 L2.5 -1' : v === 1 ? 'M-2.5 -4 L2.5 0 L-2.5 4' : 'M-2.5 -3 L2.5 3 M2.5 -3 L-2.5 3'}
        transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(0)})`}
        stroke="#f6c97a"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    )
  }
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} role="img" aria-label="Védő pecsét">
      <Defs />
      <defs>
        <radialGradient id="sl-core" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset=".5" stopColor="#f6b955" stopOpacity=".7" />
          <stop offset="1" stopColor="#f6b955" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="url(#sl-core)" opacity=".45" />
      <g filter="url(#cr-glow)" fill="none" stroke="#f6c97a" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="100" cy="100" r="92" strokeWidth="2.2" />
        <circle cx="100" cy="100" r="86" strokeWidth="1" />
        <circle cx="100" cy="100" r="58" strokeWidth="1.4" />
        <path d={ticks.join(' ')} strokeWidth="1" />
        <polygon points={star.join(' ')} strokeWidth="2.6" />
      </g>
      <g filter="url(#cr-glow)">{runes}</g>
      <circle cx="100" cy="100" r="9" fill="#fff6dc" filter="url(#cr-glow)" />
    </svg>
  )
}

export const Vampire = withImage(VampireSvg, 'vampir', 'Vámpír')
export const Ghost = withImage(GhostSvg, 'szellem', 'Szellem')
export const Werewolf = withImage(WerewolfSvg, 'verfarkas', 'Vérfarkas')
export const Seal = withImage(SealSvg, 'siker', 'Védő pecsét')
