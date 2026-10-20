import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { callWithRetry } from '../lib/retry'

// Saját PIN: a játékos egyszer megad egy 6 jegyű számot, és ha később kilép,
// az email címével + ezzel a PIN-nel újra be tud lépni, új levél kérése nélkül.
//   mode = 'setup'  → belépés utáni első beállítás (kihagyható)
//   mode = 'change' → /pin oldal: PIN módosítása
export default function PinScreen({ mode = 'setup', onDone, onSkip }) {
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [waitSecs, setWaitSecs] = useState(0)

  const valid = /^\d{6}$/.test(pin) && pin === pin2

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError('')
    const { error: err } = await callWithRetry(
      () => supabase.auth.updateUser({ password: pin, data: { pin_set: true } }),
      setWaitSecs
    )
    // Ha ugyanazt a PIN-t adta meg, mint eddig, az is rendben van.
    const same = err && /different from the old/i.test(err.message)
    if (err && !same) {
      setError(`A PIN mentése nem sikerült: ${err.message}`)
      setSaving(false)
      return
    }
    if (same) await supabase.auth.updateUser({ data: { pin_set: true } })
    setSaving(false)
    onDone?.()
  }

  const inputCls =
    'rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone text-center tracking-[0.5em] text-xl placeholder:text-ritual-gray placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-ritual-orange'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ritual-black safe-top safe-bottom">
      <h1 className="font-display text-3xl text-ritual-orange mb-2 text-center">
        {mode === 'change' ? 'PIN módosítása' : 'Saját PIN'}
      </h1>
      <p className="text-ritual-gray text-center mb-8 max-w-sm">
        Válassz egy 6 jegyű számot, amit könnyen megjegyzel. Ha később kilépsz a játékból, az email címeddel és ezzel a
        PIN-nel újra be tudsz lépni — nem kell új belépőt kérned.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          autoFocus
          placeholder="6 jegyű PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className={inputCls}
        />
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          placeholder="PIN mégegyszer"
          value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
          className={inputCls}
        />
        {pin2.length === 6 && pin !== pin2 && <p className="text-monster-vampire text-sm">A két PIN nem egyezik.</p>}
        <button
          type="submit"
          disabled={!valid || saving}
          className="rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
        >
          {saving ? 'Mentés…' : 'PIN mentése'}
        </button>
        {waitSecs > 0 && (
          <p className="text-ritual-orange text-sm text-center">
            Most nagyon sokan lépnek be egyszerre — magától újrapróbáljuk ({waitSecs} mp).
          </p>
        )}
        {error && <p className="text-monster-vampire text-sm">{error}</p>}
      </form>

      <button onClick={onSkip} className="mt-8 text-ritual-gray text-sm underline">
        {mode === 'change' ? 'Mégse' : 'Most nem — kihagyom'}
      </button>
    </div>
  )
}
