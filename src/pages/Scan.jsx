import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { supabase } from '../lib/supabaseClient'

export default function Scan() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const busyRef = useRef(false)
  const lastRef = useRef({ code: '', at: 0 })
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  async function submitCode(raw) {
    const code = raw.trim()
    if (!code || busyRef.current) return
    // ugyanazt a hibás kódot 3 mp-ig nem küldjük újra
    if (lastRef.current.code === code && Date.now() - lastRef.current.at < 3000) return
    busyRef.current = true
    lastRef.current = { code, at: Date.now() }
    setError('')
    const { data, error: err } = await supabase.rpc('scan_station', { p_code: code })
    busyRef.current = false
    if (err) {
      setError(err.message)
      return
    }
    navigate(`/task/${data}`, { replace: true })
  }

  useEffect(() => {
    let stream
    let timer
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        })
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        const tick = () => {
          if (stopped) return
          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
            const scale = Math.min(1, 640 / video.videoWidth)
            canvas.width = Math.round(video.videoWidth * scale)
            canvas.height = Math.round(video.videoHeight * scale)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const result = jsQR(img.data, img.width, img.height)
            if (result?.data) submitCode(result.data)
          }
          timer = setTimeout(tick, 250)
        }
        tick()
      } catch {
        setError(
          'A kamera nem érhető el. Engedélyezd a böngészőben, vagy írd be a QR-kód alatti kódot kézzel.'
        )
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
        <video ref={videoRef} playsInline muted className="w-full" />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {error && <p className="text-monster-vampire text-sm mb-4">{error}</p>}

      <div className="flex gap-2 mb-6">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Kód kézzel (pl. A1B2C3D4)"
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
