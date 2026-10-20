import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { callWithRetry, isRateLimit } from '../lib/retry'

const EMAIL_KEY = 'ritual_last_email'
const RESEND_SECONDS = 45

function readSavedEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || ''
  } catch {
    return ''
  }
}
function saveEmail(v) {
  try {
    localStorage.setItem(EMAIL_KEY, v)
  } catch {
    /* privát módban nem elérhető — nem baj */
  }
}

export default function Login() {
  const [email, setEmail] = useState(readSavedEmail)
  const [status, setStatus] = useState('idle') // idle | sending | sent | pin | error
  const [errorMsg, setErrorMsg] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeDetail, setCodeDetail] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [signing, setSigning] = useState(false)
  const [waitSecs, setWaitSecs] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function sendLink() {
    setStatus('sending')
    setErrorMsg('')
    setCodeError('')

    const clean = email.trim().toLowerCase()

    // Csak az engedélyezett (céges / meghívott) címek léphetnek be.
    const { data: allowed, error: checkError } = await supabase.rpc('is_email_allowed', {
      p_email: clean
    })
    if (checkError || !allowed) {
      setStatus('error')
      setErrorMsg('Ezzel az email címmel nem lehet belépni. Használd a céges címedet!')
      return
    }

    const { error } = await callWithRetry(
      () =>
        supabase.auth.signInWithOtp({
          email: clean,
          options: {
            emailRedirectTo: window.location.origin + import.meta.env.BASE_URL + 'lobby'
          }
        }),
      setWaitSecs
    )
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      saveEmail(clean)
      setCode('')
      setCooldown(RESEND_SECONDS)
      setStatus('sent')
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendLink()
  }

  async function handlePinLogin(e) {
    e.preventDefault()
    if (!/^\d{6}$/.test(pin) || !email.trim() || signing) return
    setSigning(true)
    setPinError('')
    const clean = email.trim().toLowerCase()
    const { error } = await callWithRetry(
      () => supabase.auth.signInWithPassword({ email: clean, password: pin }),
      setWaitSecs
    )
    if (error) {
      // eslint-disable-next-line no-console
      console.error('PIN-es belépési hiba:', error)
      setPinError(
        isRateLimit(error)
          ? 'Most nagyon sokan lépnek be egyszerre. Várj egy percet, és próbáld újra!'
          : 'Hibás email cím vagy PIN. Ha nem állítottál be PIN-t, vagy nem emlékszel rá, kérj belépőt emailben.'
      )
      setSigning(false)
      return
    }
    saveEmail(clean)
    // Siker esetén az onAuthStateChange átvált a játékra.
  }

  async function handleVerify(e) {
    e.preventDefault()
    if (code.length < 6 || verifying || !email.trim()) return
    setVerifying(true)
    setCodeError('')
    setCodeDetail('')
    // A Supabase az email címeket kisbetűsen tárolja.
    const clean = email.trim().toLowerCase()
    // A kód típusa a felhasználó állapotától függ (visszatérő belépés, első
    // regisztráció, meghívott felhasználó) — sorban kipróbáljuk mindet.
    let firstError = null
    let ok = false
    for (const type of ['email', 'signup', 'magiclink']) {
      const { error } =
        type === 'email'
          ? await callWithRetry(() => supabase.auth.verifyOtp({ email: clean, token: code, type }), setWaitSecs)
          : await supabase.auth.verifyOtp({ email: clean, token: code, type })
      if (!error) {
        ok = true
        break
      }
      if (!firstError) firstError = error
      // Túlterhelés esetén a többi típus próbálgatása csak rontana a helyzeten.
      if (isRateLimit(error)) break
    }
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error('Kód ellenőrzési hiba:', firstError)
      setCodeError('A kód hibás vagy lejárt. Kérj új kódot, és a legfrissebb levélből másold be!')
      setCodeDetail(`${firstError?.message ?? 'ismeretlen hiba'}${firstError?.status ? ` (${firstError.status})` : ''}`)
      setVerifying(false)
    }
    // Siker esetén az onAuthStateChange átvált a játékra.
  }

  const inputCls =
    'rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone placeholder:text-ritual-gray focus:outline-none focus:border-ritual-orange'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ritual-black safe-top safe-bottom">
      <h1 className="font-display text-3xl text-ritual-orange mb-2 text-center">Éjszakai Rituálé</h1>
      <p className="text-ritual-gray text-center mb-8 max-w-sm">
        Lépj be a céges email címeddel. Belépés után megadod a neved, és a szervezők beosztanak a csapatodba.
      </p>

      {waitSecs > 0 && (
        <p className="mb-6 max-w-sm text-center text-ritual-orange text-sm">
          Most nagyon sokan lépnek be egyszerre — nem kell semmit csinálnod, magától újrapróbáljuk ({waitSecs} mp).
        </p>
      )}

      {status === 'sent' ? (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="bg-ritual-purpleDark border border-ritual-purple rounded-2xl p-5 text-center">
            <p className="text-ritual-bone">
              Elküldtük a belépőt a <span className="text-ritual-orange">{email.trim()}</span> címre.
            </p>
            <p className="text-ritual-gray text-sm mt-2">
              Kattints a levélben lévő linkre — vagy, ha a link nem működik (pl. másik böngészőben nyílik meg),
              írd be itt a levélben kapott kódot:
            </p>
          </div>

          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="Kód a levélből"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${inputCls} text-center tracking-[0.3em] text-lg`}
            />
            <button
              type="submit"
              disabled={code.length < 6 || !email.trim() || verifying}
              className="rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
            >
              {verifying ? 'Ellenőrzés…' : 'Belépés a kóddal'}
            </button>
            {codeError && <p className="text-monster-vampire text-sm">{codeError}</p>}
            {codeDetail && <p className="text-ritual-gray text-xs break-words">Részletek: {codeDetail}</p>}
          </form>

          <div className="flex flex-col items-center gap-2 text-sm">
            <button
              onClick={sendLink}
              disabled={cooldown > 0 || !email.trim()}
              className="text-ritual-orange underline disabled:text-ritual-gray disabled:no-underline"
            >
              {cooldown > 0 ? `Új belépő kérése (${cooldown} mp)` : 'Új belépő kérése'}
            </button>
            <button
              onClick={() => {
                setStatus('idle')
                setCode('')
                setCodeError('')
                setErrorMsg('')
              }}
              className="text-ritual-gray underline"
            >
              Másik email cím
            </button>
          </div>
        </div>
      ) : status === 'pin' ? (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="bg-ritual-purpleDark border border-ritual-purple rounded-2xl p-5 text-center">
            <p className="text-ritual-bone">Belépés PIN-kóddal</p>
            <p className="text-ritual-gray text-sm mt-2">
              Add meg az email címedet és a regisztrációkor választott 6 jegyű PIN-t. Nem küldünk levelet.
            </p>
          </div>
          <form onSubmit={handlePinLogin} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="nev.vezeteknev@ceg.hu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              placeholder="6 jegyű PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className={`${inputCls} text-center tracking-[0.5em] text-xl`}
            />
            <button
              type="submit"
              disabled={pin.length !== 6 || !email.trim() || signing}
              className="rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
            >
              {signing ? 'Belépés…' : 'Belépés'}
            </button>
            {pinError && <p className="text-monster-vampire text-sm">{pinError}</p>}
          </form>
          <div className="flex flex-col items-center gap-2 text-sm">
            <button onClick={sendLink} disabled={!email.trim()} className="text-ritual-orange underline disabled:text-ritual-gray">
              Elfelejtettem a PIN-t — belépő kérése emailben
            </button>
            <button
              onClick={() => {
                setStatus('idle')
                setPin('')
                setPinError('')
              }}
              className="text-ritual-gray underline"
            >
              Vissza
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="nev.vezeteknev@ceg.hu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold disabled:opacity-50"
          >
            {status === 'sending' ? 'Küldés…' : 'Belépő kérése'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('pin')
              setPin('')
              setPinError('')
              setErrorMsg('')
            }}
            className="rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone"
          >
            Már regisztráltam — belépés PIN-kóddal
          </button>
          <p className="text-ritual-gray text-xs text-center">
            Ha már regisztráltál, nem kell új meghívó: lépj be a saját PIN-kóddal, vagy kérj új belépőt.
          </p>
          {status === 'error' && <p className="text-monster-vampire text-sm">{errorMsg}</p>}
        </form>
      )}
    </div>
  )
}
