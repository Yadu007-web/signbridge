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
const MEDIAPIPE_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915'

export function useGestureCapture(
  onBufferFull: (frames: LandmarkFrame[]) => void,
  active: boolean = true
) {
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handsRef = useRef<unknown>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bufferRef = useRef<LandmarkFrame[]>([])
  const onBufferFullRef = useRef(onBufferFull)
  const activeRef = useRef(active)
  const [status, setStatus] = useState<GestureStatus>('idle')
  const [confidence, setConfidence] = useState(0)
  const [handsDetected, setHandsDetected] = useState(false)

  useEffect(() => {
    onBufferFullRef.current = onBufferFull
  }, [onBufferFull])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const loadScript = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = src
      script.crossOrigin = 'anonymous'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(script)
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        setStatus('initialising')

        await loadScript(`${MEDIAPIPE_CDN}/hands.js`)

        if (cancelled) return

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })

        if (cancelled) {
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const HandsClass = (window as any).Hands
        if (!HandsClass) throw new Error('MediaPipe Hands not loaded')

        const hands = new HandsClass({
          locateFile: (file: string) => `${MEDIAPIPE_CDN}/${file}`,
        })

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hands.onResults((results: any) => {
          if (
            !results.multiHandLandmarks ||
            results.multiHandLandmarks.length === 0
          ) {
            setHandsDetected(false)
            return
          }

          const landmarks = results.multiHandLandmarks[0]
          const score = results.multiHandedness?.[0]?.score ?? 0

          if (score < 0.7) {
            setHandsDetected(false)
            setConfidence(score)
            return
          }

          setHandsDetected(true)
          setConfidence(score)

          const flat: number[] = landmarks.flatMap(
            (lm: { x: number; y: number; z: number }) => [lm.x, lm.y, lm.z]
          )

          const frame: LandmarkFrame = {
            landmarks: flat,
            confidence: score,
            timestamp: Date.now(),
          }

          bufferRef.current.push(frame)
          if (bufferRef.current.length > BUFFER_SIZE) {
            bufferRef.current.shift()
          }
          if (bufferRef.current.length === BUFFER_SIZE) {
            onBufferFullRef.current([...bufferRef.current])
          }
        })

        handsRef.current = hands

        await hands.initialize()

        if (cancelled) return

        setStatus('ready')

        intervalRef.current = setInterval(async () => {
          if (!activeRef.current) return
          if (!videoRef.current || videoRef.current.readyState < 2) return
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (handsRef.current as any).send({
              image: videoRef.current,
            })
          } catch {
            // silent — frame dropped
          }
        }, 33)

        setStatus('capturing')
      } catch (err) {
        console.error('Gesture init error:', err)
        if (!cancelled) setStatus('error')
      }
    }

    init()

    return () => {
      cancelled = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [loadScript])

  return { status, confidence, handsDetected }
}
