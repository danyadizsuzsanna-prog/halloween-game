// A győztes meghatározása (PO döntés, 2026-11-04):
//   1. csak a tiszta siker (mind a 6 alapanyag megvan, és mind helyes) versenyezhet;
//   2. előbb a frissesség dönt: kevesebb romlott (3 percen túl szerzett) alapanyag a jobb;
//   3. azonos frissességnél a teljes idő: a játék indításától a rituálé beküldéséig,
//      a rövidebb nyer;
//   4. ha még ez is azonos (gyakorlatilag lehetetlen), stabil sorsolás.

// Stabil "véletlen": ne ugráljon a lista frissítéskor.
export function stableRandom(id) {
  const str = String(id ?? '')
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

// Hány felhasznált alapanyag romlott (stale)?
export function staleCountOf(s) {
  if (Array.isArray(s.ingredients)) {
    return s.ingredients.filter((i) => i.freshness === 'stale').length
  }
  // Részletek nélkül a frissességi pontból (friss = 1, romlott = 0,5; 6 alapanyag átlaga)
  return Math.max(0, Math.round((1 - Number(s.freshness_score ?? 1)) * 12))
}

export function rankSubmissions(submissions, startsAt) {
  const t0 = startsAt ? new Date(startsAt).getTime() : null
  const list = submissions
    .filter((s) => s.is_complete && !s.final_monster)
    .map((s) => {
      const at = new Date(s.submitted_at).getTime()
      return {
        ...s,
        stale: staleCountOf(s),
        at,
        elapsed: t0 && Number.isFinite(at) ? Math.max(0, Math.round((at - t0) / 1000)) : null
      }
    })
    .sort((a, b) => a.stale - b.stale || a.at - b.at || stableRandom(a.id) - stableRandom(b.id))

  return list.map((s, i) => ({
    ...s,
    rank: i + 1,
    // csak akkor döntetlen, ha a frissesség ÉS a beküldés időpontja is azonos
    tied: [list[i - 1], list[i + 1]].some((o) => o && o.stale === s.stale && o.at === s.at)
  }))
}

export function formatElapsed(sec) {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function freshnessLabel(stale) {
  if (stale === 0) return 'Minden alapanyag friss'
  return `${stale} alapanyag már kevésbé friss`
}
