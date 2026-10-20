import { useId, useState } from 'react'

// Képfájlok helye: public/img/<készlet>/<slug>.webp (lásd lib/images.js). Ha egy
// kép nem tölt be, a beépített vektoros rajz (lent) lép a helyére, így sosem
// marad üres a hely.
import { imgUrl } from '../lib/images'

// Hat egyedi alapanyag-ikon — sötét, árnyékolt, texturált megjelenéssel.
// Minden ikon 64x64-es vektor, gradiensekkel és fény-effektekkel; a gradiens-
// azonosítókat példányonként egyedivé tesszük (useId), így több ikon is lehet
// egy oldalon ütközés nélkül.
//
// Használat:
//   <IngredientIcon name="Ezüstpor" size={48} />
//   <IngredientIcon slug="hollokonny" locked />   // sziluett: még nincs meg

const SLUG_BY_NAME = {
  Boszorkánygyökér: 'boszorkanygyoker',
  Ezüstpor: 'ezustpor',
  Obszidiánszilánk: 'obszidianszilank',
  Szellembogyó: 'szellembogyo',
  Árnyékgomba: 'arnyekgomba',
  Hollókönny: 'hollokonny'
}

// Fix sorrend — a rituálé-gyűrűben és a leltárban is ez a hely állandó.
export const INGREDIENTS = [
  { slug: 'boszorkanygyoker', name: 'Boszorkánygyökér' },
  { slug: 'ezustpor', name: 'Ezüstpor' },
  { slug: 'obszidianszilank', name: 'Obszidiánszilánk' },
  { slug: 'szellembogyo', name: 'Szellembogyó' },
  { slug: 'arnyekgomba', name: 'Árnyékgomba' },
  { slug: 'hollokonny', name: 'Hollókönny' }
]

export function slugFor(nameOrSlug) {
  if (!nameOrSlug) return null
  return SLUG_BY_NAME[nameOrSlug] ?? nameOrSlug
}

// Közös lágy ragyogás-szűrő (p = egyedi előtag)
const Glow = ({ p, std = 1.6 }) => (
  <filter id={`${p}glow`} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation={std} result="b" />
    <feMerge>
      <feMergeNode in="b" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
)

const ART = {
  // Girbegurba, kérges gyökér, hajszálvékony gyökérszálakkal és halvány, izzó érrel
  boszorkanygyoker: (p) => (
    <>
      <defs>
        <linearGradient id={`${p}bark`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a1a10" />
          <stop offset=".45" stopColor="#7a4e2c" />
          <stop offset="1" stopColor="#24160d" />
        </linearGradient>
        <radialGradient id={`${p}halo`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#d9772f" stopOpacity=".28" />
          <stop offset="1" stopColor="#d9772f" stopOpacity="0" />
        </radialGradient>
        <Glow p={p} std={1.2} />
      </defs>
      <circle cx="32" cy="34" r="30" fill={`url(#${p}halo)`} />
      <g fill="none" strokeLinecap="round" stroke="#2e1d12">
        <path d="M30 34 C22 36 15 42 9 53" strokeWidth="3" />
        <path d="M29 24 C21 22 15 25 9 17" strokeWidth="2.6" />
        <path d="M34 42 C43 42 50 38 56 29" strokeWidth="3" />
        <path d="M35 28 C44 28 49 23 53 13" strokeWidth="2.2" />
        <path d="M31 48 C27 54 21 58 17 61" strokeWidth="1.6" />
        <path d="M34 52 C38 56 44 59 48 61" strokeWidth="1.6" />
      </g>
      <g fill="none" strokeLinecap="round" stroke="#3a2616" strokeWidth=".9">
        <path d="M9 53 q-3 2 -4 5 M9 53 q1 4 -1 7 M9 17 q-3 -1 -5 1 M56 29 q3 -1 5 1 M56 29 q2 3 1 6" />
        <path d="M17 61 q-2 1 -3 3 M48 61 q2 1 3 3 M53 13 q2 -2 5 -2" />
      </g>
      <path
        d="M30 5 C23 11 34 17 28 25 C21 33 34 40 28 49 C26 54 28 59 31 61 C36 59 37 54 36 49 C42 41 31 33 37 26 C43 20 34 13 36 7 Z"
        fill={`url(#${p}bark)`}
        stroke="#150d08"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <g fill="none" stroke="#120a06" strokeWidth=".9" strokeLinecap="round" opacity=".85">
        <path d="M29 12 q3 2 1 5 M31 27 q3 1 2 4 M30 38 q3 2 1 5 M33 15 q1 3 -1 5 M33 44 q-2 2 -1 5" />
      </g>
      <path d="M31 8 C26 14 35 19 29 26" stroke="#c28a56" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".55" />
      <path
        d="M32 12 C30 22 36 30 32 40 C31 46 32 52 32 56"
        stroke="#e8893a"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        filter={`url(#${p}glow)`}
        opacity=".85"
      />
      <path d="M30 5 C25 2 20 3 18 7 C23 10 28 9 30 5 Z" fill="#3b2a52" stroke="#150d20" strokeWidth=".8" />
      <path d="M36 7 C41 3 47 4 48 8 C43 11 38 11 36 7 Z" fill="#4b3668" stroke="#150d20" strokeWidth=".8" />
    </>
  ),

  // Repedt üvegfiola, benne hidegen izzó ezüstpor
  ezustpor: (p) => (
    <>
      <defs>
        <radialGradient id={`${p}halo`} cx=".5" cy=".6" r=".5">
          <stop offset="0" stopColor="#cfe0ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#cfe0ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9fb2cc" stopOpacity=".55" />
          <stop offset=".35" stopColor="#2a2340" stopOpacity=".55" />
          <stop offset="1" stopColor="#9fb2cc" stopOpacity=".4" />
        </linearGradient>
        <radialGradient id={`${p}dust`} cx=".5" cy=".3" r=".8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#c9d3e6" />
          <stop offset="1" stopColor="#6f7c96" />
        </radialGradient>
        <linearGradient id={`${p}cork`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a3220" />
          <stop offset=".5" stopColor="#a67a4a" />
          <stop offset="1" stopColor="#3a2616" />
        </linearGradient>
        <Glow p={p} std={1.4} />
      </defs>
      <circle cx="32" cy="38" r="30" fill={`url(#${p}halo)`} />
      <path d="M25 5 h14 l1 7 h-16 z" fill={`url(#${p}cork)`} stroke="#1e130a" strokeWidth="1" />
      <path d="M27 7 l1 4 M31 6 l0 5 M35 7 l-1 4" stroke="#2a1a0e" strokeWidth=".8" />
      <rect x="23" y="12" width="18" height="4" rx="1" fill="#454a5e" stroke="#151826" strokeWidth=".8" />
      <path
        d="M26 16 h12 v8 c9 4 15 12 15 22 a9 9 0 0 1 -9 10 h-24 a9 9 0 0 1 -9 -10 c0 -10 6 -18 15 -22 z"
        fill={`url(#${p}glass)`}
        stroke="#aebfd6"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M13 46 c5 -3 10 3 17 0 s13 -3 19 1 c.5 5 -3 11 -9 11 h-23 a9 9 0 0 1 -4 -12 z"
        fill={`url(#${p}dust)`}
        filter={`url(#${p}glow)`}
      />
      <path d="M29 20 L32 31 L28 38 L31 47" stroke="#e8f1fb" strokeWidth=".9" fill="none" opacity=".75" strokeLinejoin="round" />
      <path d="M31 31 L37 34" stroke="#e8f1fb" strokeWidth=".7" opacity=".6" />
      <path d="M20 32 q-2 8 0 14" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".45" />
      <g fill="#ffffff" filter={`url(#${p}glow)`}>
        <circle cx="21" cy="50" r=".9" />
        <circle cx="36" cy="49" r=".8" />
        <circle cx="43" cy="53" r=".9" />
        <circle cx="30" cy="40" r=".7" />
        <circle cx="38" cy="30" r=".8" opacity=".8" />
        <circle cx="26" cy="33" r=".6" opacity=".7" />
      </g>
    </>
  ),

  // Éles, fekete vulkáni üveg — mélyén vöröslő izzás
  obszidianszilank: (p) => (
    <>
      <defs>
        <radialGradient id={`${p}ember`} cx=".5" cy="1" r=".7">
          <stop offset="0" stopColor="#e5482f" stopOpacity=".75" />
          <stop offset=".6" stopColor="#7a1f3a" stopOpacity=".25" />
          <stop offset="1" stopColor="#7a1f3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}f1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a4686" />
          <stop offset="1" stopColor="#1a1226" />
        </linearGradient>
        <linearGradient id={`${p}f2`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2142" />
          <stop offset="1" stopColor="#0c0814" />
        </linearGradient>
        <linearGradient id={`${p}f3`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12091d" />
          <stop offset="1" stopColor="#050309" />
        </linearGradient>
        <Glow p={p} std={1.4} />
      </defs>
      <path d="M44 28 L56 46 L52 60 L45 60 Z" fill={`url(#${p}f2)`} stroke="#6b5594" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M32 3 L48 24 L43 60 L22 60 L13 27 Z" fill={`url(#${p}f3)`} />
      <path d="M32 3 L48 24 L36 28 Z" fill={`url(#${p}f1)`} />
      <path d="M32 3 L36 28 L21 31 L13 27 Z" fill={`url(#${p}f2)`} />
      <path d="M48 24 L43 60 L36 28 Z" fill="#241a38" />
      <path d="M36 28 L43 60 L29 60 L21 31 Z" fill="#0f0919" />
      <path d="M13 27 L21 31 L29 60 L22 60 Z" fill="#07040c" />
      <rect x="13" y="38" width="40" height="24" fill={`url(#${p}ember)`} />
      <path
        d="M32 3 L48 24 L43 60 L22 60 L13 27 Z"
        fill="none"
        stroke="#9a82c9"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M36 28 L21 31 M36 28 L32 3 M36 28 L43 60" stroke="#7d66ad" strokeWidth=".8" opacity=".8" />
      <path d="M31 9 L25 25" stroke="#f0e6ff" strokeWidth="1.8" strokeLinecap="round" opacity=".85" filter={`url(#${p}glow)`} />
      <path d="M40 32 L38 46" stroke="#cdb9f5" strokeWidth="1" strokeLinecap="round" opacity=".5" />
    </>
  ),

  // Áttetsző, derengő bogyók — mélyükön halvány, sikoltó arcok
  szellembogyo: (p) => (
    <>
      <defs>
        <radialGradient id={`${p}halo`} cx=".5" cy=".55" r=".5">
          <stop offset="0" stopColor="#9fc4e8" stopOpacity=".38" />
          <stop offset="1" stopColor="#9fc4e8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}berry`} cx=".38" cy=".3" r=".8">
          <stop offset="0" stopColor="#f1fbff" />
          <stop offset=".4" stopColor="#9db6d2" />
          <stop offset="1" stopColor="#3b4a66" />
        </radialGradient>
        <Glow p={p} std={1.8} />
      </defs>
      <circle cx="32" cy="38" r="31" fill={`url(#${p}halo)`} />
      <path d="M32 6 C31 13 33 17 31 24" stroke="#1d2a22" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M32 8 C38 2 47 4 49 10 C43 14 36 13 32 8 Z" fill="#26362b" stroke="#0e1612" strokeWidth=".8" />
      <path d="M33 9 C38 6 43 6 46 9" stroke="#5f7a62" strokeWidth=".7" fill="none" opacity=".7" />
      <g filter={`url(#${p}glow)`}>
        <circle cx="21" cy="45" r="12.5" fill={`url(#${p}berry)`} />
        <circle cx="43" cy="45" r="12.5" fill={`url(#${p}berry)`} />
        <circle cx="32" cy="29" r="13" fill={`url(#${p}berry)`} />
      </g>
      <g fill="#0b1018" opacity=".85">
        <ellipse cx="28.5" cy="27" rx="1.9" ry="3" />
        <ellipse cx="35.5" cy="27" rx="1.9" ry="3" />
        <ellipse cx="32" cy="34" rx="2" ry="3.6" />
        <ellipse cx="17.5" cy="43" rx="1.6" ry="2.4" opacity=".6" />
        <ellipse cx="24.5" cy="43" rx="1.6" ry="2.4" opacity=".6" />
        <ellipse cx="39.5" cy="43" rx="1.6" ry="2.4" opacity=".6" />
        <ellipse cx="46.5" cy="43" rx="1.6" ry="2.4" opacity=".6" />
      </g>
      <ellipse cx="27" cy="22" rx="3.6" ry="2" fill="#ffffff" opacity=".8" transform="rotate(-30 27 22)" />
      <ellipse cx="15.5" cy="39" rx="2.8" ry="1.6" fill="#ffffff" opacity=".6" transform="rotate(-30 15.5 39)" />
      <ellipse cx="37.5" cy="39" rx="2.8" ry="1.6" fill="#ffffff" opacity=".6" transform="rotate(-30 37.5 39)" />
    </>
  ),

  // Nedves, fekete-lila kalap, kopoltyús alsó oldallal, kígyózó árnyékfüsttel
  arnyekgomba: (p) => (
    <>
      <defs>
        <linearGradient id={`${p}cap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b3f9e" />
          <stop offset=".45" stopColor="#2f1a4d" />
          <stop offset="1" stopColor="#0f0818" />
        </linearGradient>
        <linearGradient id={`${p}stem`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a4058" />
          <stop offset=".45" stopColor="#a69cb8" />
          <stop offset="1" stopColor="#3a3148" />
        </linearGradient>
        <radialGradient id={`${p}halo`} cx=".5" cy=".4" r=".55">
          <stop offset="0" stopColor="#8a5fd0" stopOpacity=".3" />
          <stop offset="1" stopColor="#8a5fd0" stopOpacity="0" />
        </radialGradient>
        <filter id={`${p}blur`}>
          <feGaussianBlur stdDeviation=".9" />
        </filter>
        <Glow p={p} std={1.3} />
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${p}halo)`} />
      <g fill="none" stroke="#9a78d9" strokeLinecap="round" opacity=".7" filter={`url(#${p}blur)`}>
        <path d="M14 58 c-6 -4 -3 -10 2 -9 s4 6 -1 7" strokeWidth="2" />
        <path d="M50 58 c6 -4 3 -10 -2 -9 s-4 6 1 7" strokeWidth="2" />
        <path d="M32 9 c-4 -4 1 -7 3 -4" strokeWidth="1.6" />
      </g>
      <path d="M26 34 h12 l1 14 c0 6 -3 11 -7 11 s-7 -5 -7 -11 z" fill={`url(#${p}stem)`} stroke="#1b1426" strokeWidth="1" />
      <path d="M26 41 q6 3 12 0 M26.5 47 q5.5 3 11 0" stroke="#2a2036" strokeWidth=".9" fill="none" />
      <path d="M7 36 C7 20 19 10 32 10 C45 10 57 20 57 36 C49 40 15 40 7 36 Z" fill={`url(#${p}cap)`} stroke="#0b0612" strokeWidth="1.2" />
      <path d="M7 36 C15 40 49 40 57 36 C55 42 45 45 32 45 C19 45 9 42 7 36 Z" fill="#12081d" />
      <g stroke="#3a2456" strokeWidth=".7" opacity=".9">
        <path d="M32 40 L32 45 M24 39 L22 44 M40 39 L42 44 M16 37 L12 41 M48 37 L52 41" />
      </g>
      <path d="M12 29 C14 20 21 14 30 12" stroke="#c9a6ff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".55" />
      <g fill="#b99be6" opacity=".85">
        <circle cx="24" cy="25" r="2.6" />
        <circle cx="41" cy="21" r="2" />
        <circle cx="47" cy="30" r="1.7" />
        <circle cx="34" cy="31" r="1.4" />
      </g>
      <g fill="#d8c2ff" filter={`url(#${p}glow)`}>
        <circle cx="50" cy="12" r=".8" />
        <circle cx="14" cy="14" r=".7" />
        <circle cx="54" cy="22" r=".6" />
      </g>
    </>
  ),

  // Éjfekete, jéghideg könnycsepp — benne hollótoll, élesen tükröződő fénnyel
  hollokonny: (p) => (
    <>
      <defs>
        <linearGradient id={`${p}drop`} x1=".2" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#3a4d7a" />
          <stop offset=".5" stopColor="#141c33" />
          <stop offset="1" stopColor="#05070f" />
        </linearGradient>
        <radialGradient id={`${p}halo`} cx=".5" cy=".6" r=".5">
          <stop offset="0" stopColor="#6f8fd0" stopOpacity=".28" />
          <stop offset="1" stopColor="#6f8fd0" stopOpacity="0" />
        </radialGradient>
        <Glow p={p} std={1.1} />
      </defs>
      <circle cx="32" cy="38" r="30" fill={`url(#${p}halo)`} />
      <path
        d="M32 4 C32 4 12 28 12 42 a20 20 0 0 0 40 0 C52 28 32 4 32 4 Z"
        fill={`url(#${p}drop)`}
        stroke="#8aa3cf"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <g transform="rotate(24 33 40)">
        <path d="M33 22 C43 29 43 46 33 60 C23 46 23 29 33 22 Z" fill="#020309" stroke="#2a3558" strokeWidth=".7" />
        <path d="M33 25 L33 59" stroke="#7d8fb8" strokeWidth="1" strokeLinecap="round" />
        <g stroke="#3c4a75" strokeWidth=".8" strokeLinecap="round">
          <path d="M33 31 l6 3 M33 37 l7 3 M33 43 l6 3 M33 49 l4 2" />
          <path d="M33 31 l-6 3 M33 37 l-7 3 M33 43 l-6 3 M33 49 l-4 2" />
        </g>
      </g>
      <path d="M19 28 C16 36 16 44 21 51" stroke="#e8f1fb" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".8" filter={`url(#${p}glow)`} />
      <circle cx="42" cy="22" r="1.5" fill="#ffffff" opacity=".85" />
      <circle cx="44" cy="52" r="1" fill="#ffffff" opacity=".35" />
    </>
  )
}

export default function IngredientIcon({
  name,
  slug,
  size = 48,
  locked = false,
  className = '',
  title
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [imgFailed, setImgFailed] = useState(false)
  const key = slugFor(slug ?? name)
  const art = ART[key]
  const label = title ?? name ?? key

  if (art && !imgFailed) {
    return (
      <img
        src={imgUrl(key)}
        width={size}
        height={size}
        alt={label}
        title={label}
        draggable={false}
        className={className}
        onError={() => setImgFailed(true)}
        style={{
          objectFit: 'contain',
          ...(locked ? { filter: 'grayscale(1) brightness(.35) contrast(1.1)', opacity: 0.6 } : null)
        }}
      />
    )
  }

  if (!art) {
    // ismeretlen alapanyag: egyszerű kérdőjel-korong, hogy sose legyen üres a hely
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label={label}>
        <circle cx="32" cy="32" r="22" fill="#221231" stroke="#5b5560" strokeWidth="2" />
        <text x="32" y="42" textAnchor="middle" fontSize="28" fill="#5b5560">?</text>
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={label}
      style={locked ? { filter: 'grayscale(1) brightness(.4) contrast(1.1)', opacity: 0.6 } : undefined}
    >
      <title>{label}</title>
      {art(`i${uid}`)}
    </svg>
  )
}
