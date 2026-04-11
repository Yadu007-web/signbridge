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

export function useGestureCapture(
  onBufferFull: (frames: LandmarkFrame[]) => void,
  active: boolean = true
) {
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
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

  const beginInterval = useCallback(() => {
    if (!videoRef.current || !workerRef.current) return
    if (intervalRef.current) return
    const video = videoRef.current
    intervalRef.current = setInterval(() => {
      if (!activeRef.current) return
      if (video.readyState < 2) return
      createImageBitmap(video)
        .then((bmp) => {
          workerRef.current?.postMessage({ type: 'FRAME', bitmap: bmp }, [bmp])
        })
        .catch((err) => console.warn('Frame capture error:', err))
    }, 33)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
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

        const worker = new Worker('/workers/gesture.worker.js')
        workerRef.current = worker

        worker.onmessage = (e) => {
          const { type } = e.data
          if (type === 'READY') {
            setStatus('ready')
            if (activeRef.current) {
              beginInterval()
              setStatus('capturing')
            }
            return
          }
          if (type === 'NO_HANDS') {
            setHandsDetected(false)
            return
          }
          if (type === 'LOW_CONFIDENCE') {
            setHandsDetected(false)
            setConfidence(e.data.confidence)
            return
          }
          if (type === 'LANDMARKS') {
            setHandsDetected(true)
            setConfidence(e.data.confidence)
            const frame: LandmarkFrame = {
              landmarks: e.data.landmarks,
              confidence: e.data.confidence,
              timestamp: e.data.timestamp,
            }
            bufferRef.current.push(frame)
            if (bufferRef.current.length > BUFFER_SIZE) {
              bufferRef.current.shift()
            }
            if (bufferRef.current.length === BUFFER_SIZE) {
              onBufferFullRef.current([...bufferRef.current])
            }
          }
        }

        worker.postMessage({ type: 'INIT' })
        setStatus('initialising')
      } catch {
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
      workerRef.current?.terminate()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [beginInterval])

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  return { status, confidence, handsDetected, stopCapture }
}
