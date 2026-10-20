// Egy közös wifiről belépő sok játékos ugyanazt az IP-alapú Supabase-korlátot
// használja, ezért belépéskor előfordulhat "429 / rate limit" válasz. Ilyenkor a
// játékosnak nem kell semmit csinálnia: pár másodperc múlva magától újrapróbáljuk.

export function isRateLimit(err) {
  if (!err) return false
  const msg = `${err.message ?? ''}`
  // A felhasználónkénti "csak 60 mp múlva kérhetsz újat" üzenetet nem próbáljuk újra automatikusan.
  if (/you can only request this after/i.test(msg)) return false
  return err.status === 429 || /rate limit|too many requests/i.test(msg)
}

const DELAYS = [6, 10, 14, 18, 22, 28] // másodperc; összesen kb. 100 mp

// call: () => Promise<{ error }>; onWait(másodperc) — visszaszámláláshoz (0 = vége).
export async function callWithRetry(call, onWait = () => {}) {
  for (let i = 0; ; i++) {
    const res = await call()
    if (!isRateLimit(res?.error) || i >= DELAYS.length) {
      onWait(0)
      return res
    }
    for (let s = DELAYS[i]; s > 0; s--) {
      onWait(s)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}
