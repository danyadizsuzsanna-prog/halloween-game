import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Első belépéskor minden játékos megadja a nevét — ezen látják majd a
// csapattársai és a stáb (email címet sehol nem mutatunk).
export default function NameScreen({ onDone }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const clean = name.replace(/\s+/g, ' ').trim()
  const valid = clean.length >= 2 && clean.length <= 40

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.rpc('set_my_display_name', { p_name: clean })
    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }
    await onDone()
    setSaving(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ritual-black safe-top safe-bottom">
      <h1 className="font-display text-3xl text-ritual-orange mb-2 text-center">Hogy hívnak?</h1>
      <p className="text-ritual-gray text-center mb-8 max-w-sm">
        Add meg a neved — így fognak látni a csapattársaid. A teljes nevedet írd, hogy mindenki
        felismerjen!
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
        <input
          type="text"
          autoFocus
          autoComplete="name"
          maxLength={40}
          placeholder="Pl. Kovács Anna"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone placeholder:text-ritual-gray focus:outline-none focus:border-ritual-orange"
        />
        <button
          type="submit"
          disabled={!valid || saving}
          className="rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
        >
          {saving ? 'Mentés…' : 'Tovább'}
        </button>
        {error && <p className="text-monster-vampire text-sm">{error}</p>}
      </form>

      <button
        onClick={() => {
          if (window.confirm('Biztosan kijelentkezel?')) supabase.auth.signOut()
        }}
        className="mt-8 text-ritual-gray text-sm underline"
      >
        Nem én vagyok — kijelentkezés
      </button>
    </div>
  )
}
