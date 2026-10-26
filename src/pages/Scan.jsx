import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { supabase } from '../lib/supabaseClient'

// A QR-ban lehet sima kód (A1B2C3D4), vagy egy link, aminek a végén van a kód.
// Mindkettőből kiszedjük a tiszta kódot.
export function normalizeCode(raw) {
  const text = String(raw ?? '').trim()
  try {
    const u = new URL(text)
    const param = u.searchParams.get('code') || u.searchParams.get('c')
    if (param) return param.trim()
    const parts = `${u.pathname}/${u.hash.replace(/^#/, '')}`.split(/[/?&=]/).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return decodeURIComponent(last).trim()
  } catch {
    // nem link — marad az eredeti szöveg
  }
  return text
}

function friendlyError(message, code) {
  if (/Ismeretlen QR/i.test(message)) {
    return `Ez a QR-kód nem tartozik a játékhoz. Beolvasva: „${code}”. Ha stáb vagy, ellenőrizd, hogy a kinyomtatott kód egyezik-e az adatbázisban lévővel.`
  }
  if (/nem az az állomás/i.test(message)) {
    return 'Ez nem az az állomás, amit a kapitány választott. Menj ahhoz a helyszínhez, amit a csapatod kapott.'
  }
  return `${message} (beolvasva: „${code}”)`
}

export default function Scan() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const busyRef = useRef(false)
  const lastRef = useRef({ code: '', at: 0 })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [manual, setManual] = useState('')

  async function submitCode(raw) {
    const code = normalizeCode(raw)
    if (!code || busyRef.current) return
    // ugyanazt a hibás kódot 3 mp-ig nem küldjük újra
    if (lastRef.current.code === code && Date.now() - lastRef.current.at < 3000) return
    busyRef.current = true
    lastRef.current = { code, at: Date.now() }
    setError('')
    setInfo(`Beolvasva: ${code}`)
    const { data, error: err } = await supabase.rpc('scan_station', { p_code: code })
    busyRef.current = false
    if (err) {
      setError(friendlyError(err.message || String(err), code))
      return
    }
    navigate(`/task/${data}`, { replace: true })
  }

  useEffect(() => {
    let stream
    let timer
    let stopped = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'Ez a böngésző nem engedi a kamerát (a játékot https címen kell megnyitni). Írd be a kódot kézzel.'
        )
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })
        // folyamatos autofókusz, ha a telefon támogatja
        try {
          await stream.getVideoTracks()[0].applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          })
        } catch {
          // nem minden telefon tudja — nem baj
        }

        const video = videoRef.current
        video.srcObject = stream
        await video.play()

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        let detector = null
        try {
          if ('BarcodeDetector' in window) {
            detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          }
        } catch {
          detector = null
        }

        const tick = async () => {
          if (stopped) return
          if (video.readyState >= 2 && video.videoWidth && !busyRef.current) {
            let text = ''
            if (detector) {
              try {
                const found = await detector.detect(video)
                text = found?.[0]?.rawValue || ''
              } catch {
                detector = null
              }
            }
            if (!text) {
              const scale = Math.min(1, 1024 / video.videoWidth)
              canvas.width = Math.round(video.videoWidth * scale)
              canvas.height = Math.round(video.videoHeight * scale)
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const result = jsQR(img.data, img.width, img.height, {
                inversionAttempts: 'attemptBoth'
              })
              text = result?.data || ''
            }
            if (text) submitCode(text)
          }
          if (!stopped) timer = setTimeout(tick, 200)
        }
        tick()
      } catch (e) {
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
          setError(
            'A kamera használatát letiltottad. Koppints a címsor melletti lakat ikonra → Engedélyek → Kamera → Engedélyezés, aztán töltsd újra az oldalt. Addig írd be a kódot kézzel.'
          )
        } else if (e?.name === 'NotFoundError') {
          setError('Nem találok kamerát ezen az eszközön. Írd be a kódot kézzel.')
        } else {
          setError(
            'A kamera nem indult el. Zárd be a többi kamerát használó appot, és töltsd újra az oldalt, vagy írd be a kódot kézzel.'
          )
        }
      }
    }
    start()

    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-ritual-black px-5 py-6 safe-top safe-bottom">
      <h1 className="font-display text-2xl text-ritual-orange mb-4">QR-kód beolvasása</h1>

      <div className="rounded-2xl overflow-hidden border border-ritual-purple bg-black mb-4">
        <video ref={videoRef} playsInline muted autoPlay className="w-full" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {info && !error && <p className="text-ritual-gray text-sm mb-4">{info}</p>}
      {error && <p className="text-monster-vampire text-sm mb-4">{error}</p>}

      <div className="flex gap-2 mb-6">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Kód kézzel (pl. A1B2C3D4)"
          autoCapitalize="characters"
          className="flex-1 rounded-xl px-4 py-3 bg-ritual-purpleDark border border-ritual-purple text-ritual-bone placeholder:text-ritual-gray"
        />
        <button
          onClick={() => submitCode(manual)}
          className="rounded-xl px-4 py-3 bg-ritual-orange text-ritual-black font-semibold"
        >
          OK
        </button>
      </div>

      <button
        onClick={() => navigate('/lobby')}
        className="w-full rounded-xl px-4 py-3 bg-transparent border border-ritual-purple text-ritual-gray"
      >
        Vissza
      </button>
    </div>
  )
}
