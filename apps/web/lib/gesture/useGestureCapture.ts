'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export type GestureStatus =
  | 'idle'
  | 'initialising'
  | 'ready'
  | 'capturing'
  | 'error'

export interface LandmarkFrame {
  landmarks: number[]
  confidence: number
  timestamp: number
}

const BUFFER_SIZE = 60
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915'

export function useGestureCapture(
  onBufferFull: (frames: LandmarkFrame[]) => void,
  active: boolean = true
) {
  const handsRef = useRef<unknown>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const bufferRef = useRef<LandmarkFrame[]>([])
  const onBufferRef = useRef(onBufferFull)
  const activeRef = useRef(active)

  const [status, setStatus] = useState<GestureStatus>('idle')
  const [confidence, setConfidence] = useState(0)
  const [handsDetected, setHandsDetected] = useState(false)

  useEffect(() => {
    onBufferRef.current = onBufferFull
  }, [onBufferFull])
  useEffect(() => {
    activeRef.current = active
  }, [active])

  const loadScript = useCallback(
    (src: string) =>
      new Promise<void>((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          // Script tag exists but Hands might not be ready yet
          // Poll until window.Hands is available
          let attempts = 0
          const poll = setInterval(() => {
            attempts++
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((window as any).Hands) {
              clearInterval(poll)
              res()
            }
            if (attempts > 100) {
              clearInterval(poll)
              rej(new Error('Hands not ready'))
            }
          }, 100)
          return
        }
        const s = document.createElement('script')
        s.src = src
        s.onload = () => {
          // Wait for Hands to be available on window
          let attempts = 0
          const poll = setInterval(() => {
            attempts++
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((window as any).Hands) {
              clearInterval(poll)
              res()
            }
            if (attempts > 100) {
              clearInterval(poll)
              rej(new Error('Hands not ready'))
            }
          }, 100)
        }
        s.onerror = () => rej(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      }),
    []
  )

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        setStatus('initialising')

        // Wait for LiveKit to claim the camera first
        await new Promise((r) => setTimeout(r, 2000))
        if (!mounted) return

        await loadScript(`${CDN}/hands.js`)
        if (!mounted) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const H = (window as any).Hands
        if (!H) throw new Error('MediaPipe Hands not available')

        const hands = new H({ locateFile: (f: string) => `${CDN}/${f}` })

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hands.onResults((results: any) => {
          if (!activeRef.current) return
          const hasHands = results.multiHandLandmarks?.length > 0
          setHandsDetected((prev) => (prev === hasHands ? prev : hasHands))
          if (!hasHands) return

          const lm = results.multiHandLandmarks[0]
          const score = results.multiHandedness?.[0]?.score ?? 0
          setConfidence((prev) =>
            Math.abs(prev - score) > 0.01 ? score : prev
          )
          if (score < 0.7) return

          const flat: number[] = lm.flatMap(
            (p: { x: number; y: number; z: number }) => [p.x, p.y, p.z]
          )

          bufferRef.current.push({
            landmarks: flat,
            confidence: score,
            timestamp: Date.now(),
          })

          if (bufferRef.current.length > BUFFER_SIZE) {
            bufferRef.current.shift()
          }

          if (bufferRef.current.length === BUFFER_SIZE) {
            onBufferRef.current([...bufferRef.current])
            bufferRef.current = bufferRef.current.slice(BUFFER_SIZE / 2)
          }
        })

        await hands.initialize()
        if (!mounted) return

        handsRef.current = hands

        // Open a second camera stream for gesture only
        // Use lower resolution to reduce conflict
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        const video = document.createElement('video')
        video.srcObject = stream
        video.autoplay = true
        video.muted = true
        video.playsInline = true
        await video.play()
        videoRef.current = video

        setStatus('capturing')

        intervalRef.current = setInterval(async () => {
          if (!activeRef.current) return
          const v = videoRef.current
          if (!v || v.readyState < 2) return
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (handsRef.current as any).send({ image: v })
          } catch {
            /* silent */
          }
        }, 33)
      } catch (err) {
        console.error('Gesture init error:', err)
        if (mounted) setStatus('error')
      }
    }

    init()

    return () => {
      mounted = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [loadScript])

  return { status, confidence, handsDetected }
}
