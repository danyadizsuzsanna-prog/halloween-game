import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL + 'lobby'
      }
    })
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ritual-black safe-top safe-bottom">
      <h1 className="font-display text-3xl text-ritual-orange mb-2 text-center">
        Éjszakai Rituálé
      </h1>
      <p className="text-ritual-gray text-center mb-8 max-w-sm">
        Lépj be a céges email címeddel — ezzel kerülsz be a csapatodba.
      </p>

      {status === 'sent' ? (
        <div className="bg-ritual-purpleDark border border-ritual-purple rounded-2xl p-6 max-w-sm text-center">
          <p className="text-ritual-bone">
            Elküldtük a belépő linket a <span className="text-ritual-orange">{email}</span>{' '}
            címre. Nyisd meg a telefonodon a levelet, és kattints a linkre!
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="nev.vezeteknev@ceg.hu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone placeholder:text-ritual-gray focus:outline-none focus:border-ritual-orange"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
          >
            {status === 'sending' ? 'Küldés…' : 'Belépő link kérése'}
          </button>
          {status === 'error' && (
            <p className="text-monster-vampire text-sm">{errorMsg}</p>
          )}
        </form>
      )}
    </div>
  )
}
