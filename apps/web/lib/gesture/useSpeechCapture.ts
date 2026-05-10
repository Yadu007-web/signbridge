'use client'
import { useEffect, useRef, useState } from 'react'

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
}

interface SpeechWindow extends Window {
  SpeechRecognition?: new () => ISpeechRecognition
  webkitSpeechRecognition?: new () => ISpeechRecognition
}

export function useSpeechCapture(
  onTranscript: (text: string, isFinal: boolean) => void,
  active: boolean = true
) {
  const onTranscriptRef = useRef(onTranscript)
  const activeRef = useRef(active)
  const recRef = useRef<ISpeechRecognition | null>(null)
  const mountedRef = useRef(true)
  const startedRef = useRef(false)

  const [listening, setListening] = useState(false)
  const [supported] = useState(
    typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )
  const [error, setError] = useState('')

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    mountedRef.current = true

    const hasSR =
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window

    if (!hasSR) {
      setError('Use Chrome for speech features')
      return
    }

    function createRec(): ISpeechRecognition {
      const SR =
        (window as SpeechWindow).SpeechRecognition ??
        (window as SpeechWindow).webkitSpeechRecognition

      if (!SR) {
        throw new Error('SpeechRecognition not supported')
      }

      const r = new SR()
      recRef.current = r
      r.continuous = true
      r.interimResults = true
      r.lang = 'en-US'
      r.maxAlternatives = 1

      r.onresult = (e: SpeechRecognitionEvent) => {
        if (!mountedRef.current) return
        setError('')
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript.trim()
          const isFinal = e.results[i].isFinal
          if (text) onTranscriptRef.current(text, isFinal)
        }
      }

      r.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (!mountedRef.current) return
        if (e.error === 'aborted' || e.error === 'no-speech') return
        if (e.error === 'not-allowed') {
          setError('Mic blocked — allow in browser settings')
        }
        startedRef.current = false
        setListening(false)
      }

      r.onstart = () => {
        if (!mountedRef.current) return
        startedRef.current = true
        setListening(true)
        setError('')
      }

      r.onend = () => {
        if (!mountedRef.current) return
        startedRef.current = false
        setListening(false)
        if (activeRef.current && mountedRef.current) {
          setTimeout(() => {
            if (!mountedRef.current || !activeRef.current) return
            const next = createRec()
            try {
              next.start()
            } catch {
              /* ignore */
            }
          }, 300)
        }
      }

      return r
    }

    const t = setTimeout(() => {
      if (!mountedRef.current) return
      const r = createRec()
      if (activeRef.current)
        try {
          r.start()
        } catch {
          /* ignore */
        }
    }, 3000)

    return () => {
      mountedRef.current = false
      clearTimeout(t)
      try {
        recRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    const r = recRef.current
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

      queueMicrotask(() => {
        if (mountedRef.current) setListening(false)
      })
    }
  }, [active])

  return { listening, supported, error }
}