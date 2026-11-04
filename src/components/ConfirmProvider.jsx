import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Játékon belüli megerősítő ablak a böngésző saját window.confirm helyett.
//
// Használat:
//   const confirm = useConfirm()
//   if (!(await confirm({ title: 'Biztos?', message: '…', confirmText: 'Igen' }))) return
//
// Beállítások: title, message (sortörés megmarad), confirmText, cancelText,
// danger (piros gomb, a "Mégse" kapja az alap fókuszt).

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)
  const confirmBtnRef = useRef(null)
  const cancelBtnRef = useRef(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      // ha már nyitva van egy ablak, azt elutasítottnak vesszük
      resolverRef.current?.(false)
      resolverRef.current = resolve
      setState(typeof options === 'string' ? { message: options } : options || {})
    })
  }, [])

  const close = useCallback((result) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setState(null)
    resolve?.(result)
  }, [])

  // Fókusz: veszélyes műveletnél a "Mégse", egyébként a megerősítő gomb
  useEffect(() => {
    if (!state) return
    const el = state.danger ? cancelBtnRef.current : confirmBtnRef.current
    el?.focus()
  }, [state])

  // Amíg az ablak nyitva van: Esc = mégse, és a többi billentyű (pl. a kivetítő
  // Szóköz / nyíl gyorsbillentyűi) nem jut el az oldalig.
  useEffect(() => {
    if (!state) return undefined
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close(false)
        return
      }
      if (e.key === 'Tab') {
        // a fókusz az ablakon belül marad
        const a = cancelBtnRef.current
        const b = confirmBtnRef.current
        if (!a || !b) return
        if (document.activeElement !== a && document.activeElement !== b) {
          e.preventDefault()
          a.focus()
        } else if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-5"
          onClick={() => close(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-[min(92vw,420px)] rounded-2xl border border-ritual-orange bg-ritual-purpleDark p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="confirm-title" className="font-display text-xl text-ritual-orange mb-2">
              {state.title || 'Biztos vagy benne?'}
            </p>
            {state.message && (
              <p className="whitespace-pre-line text-ritual-bone text-sm mb-5">{state.message}</p>
            )}
            <div className="flex gap-3">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => close(false)}
                className="flex-1 rounded-xl px-4 py-3 bg-transparent border border-ritual-purple text-ritual-bone"
              >
                {state.cancelText || 'Mégse'}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className={`flex-1 rounded-xl px-4 py-3 font-semibold ${
                  state.danger
                    ? 'bg-ritual-red text-ritual-bone'
                    : 'bg-ritual-orange text-ritual-black'
                }`}
              >
                {state.confirmText || 'Igen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  // tartalék: ha valahol a szolgáltató nélkül használják
  return (
    ctx ||
    ((options) => {
      const o = typeof options === 'string' ? { message: options } : options || {}
      return Promise.resolve(window.confirm([o.title, o.message].filter(Boolean).join('\n\n')))
    })
  )
}
