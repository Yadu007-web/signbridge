'use client'
import { useEffect, useRef, useState } from 'react'

export function useSpeechCapture(
  onTranscript: (text: string, isFinal: boolean) => void,
  active: boolean = true
) {
  const onTranscriptRef = useRef(onTranscript)
  const activeRef = useRef(active)
  const recRef = useRef<unknown>(null)
  const mountedRef = useRef(true)
  const startedRef = useRef(false)
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    mountedRef.current = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR =
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition

    if (!SR) {
      setSupported(false)
      setError('Use Chrome for speech features')
      return
    }

    setSupported(true)

    function createRecognition() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = new SR()
      r.continuous = true
      r.interimResults = true
      r.lang = 'en-US'
      r.maxAlternatives = 1
      recRef.current = r

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.onresult = (e: any) => {
        if (!mountedRef.current) return
        setError('')
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript.trim()
          const isFinal = e.results[i].isFinal
          console.log('STT:', text, 'final:', isFinal)
          if (text) onTranscriptRef.current(text, isFinal)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.onerror = (e: any) => {
        if (!mountedRef.current) return
        if (e.error === 'aborted' || e.error === 'no-speech') {
          // no-speech means silence — just restart
          return
        }
        if (e.error === 'not-allowed') {
          setError('Mic blocked — allow in browser settings')
        } else {
          console.warn('Speech error:', e.error)
        }
        startedRef.current = false
        setListening(false)
      }

      r.onstart = () => {
        if (!mountedRef.current) return
        startedRef.current = true
        setListening(true)
        setError('')
        console.log('Speech started ✅')
      }

      r.onend = () => {
        if (!mountedRef.current) return
        startedRef.current = false
        setListening(false)
        // Recreate and restart to avoid state issues
        if (activeRef.current && mountedRef.current) {
          setTimeout(() => {
            if (mountedRef.current && activeRef.current) {
              createRecognition()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              try {
                ;(recRef.current as any).start()
              } catch {
                /* ignore */
              }
            }
          }, 300)
        }
      }

      return r
    }

    // Delay start by 3 seconds to let LiveKit fully connect first
    const initTimer = setTimeout(() => {
      if (!mountedRef.current) return
      const r = createRecognition()
      if (activeRef.current) {
        try {
          r.start()
        } catch {
          /* ignore */
        }
      }
    }, 3000)

    return () => {
      mountedRef.current = false
      clearTimeout(initTimer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = recRef.current as any
      if (r)
        try {
          r.abort()
        } catch {
          /* ignore */
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = recRef.current as any
    if (!r) return
    if (active && !startedRef.current) {
      try {
        r.start()
      } catch {
        /* ignore */
      }
    } else if (!active && startedRef.current) {
      try {
        r.stop()
      } catch {
        /* ignore */
      }
      setListening(false)
    }
  }, [active])

  return { listening, supported, error }
}
