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
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onBufferFull: (frames: LandmarkFrame[]) => void,
  active: boolean = true
) {
  const workerRef = useRef<Worker | null>(null)
  const bufferRef = useRef<LandmarkFrame[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [status, setStatus] = useState<GestureStatus>('idle')
  const [confidence, setConfidence] = useState(0)
  const [handsDetected, setHandsDetected] = useState(false)

  const startCapture = useCallback(() => {
    if (!videoRef.current || !workerRef.current) return
    const video = videoRef.current

    intervalRef.current = setInterval(() => {
      if (video.readyState < 2) return
      try {
        const bitmap = createImageBitmap(video)
        bitmap.then((bmp) => {
          workerRef.current?.postMessage({ type: 'FRAME', bitmap: bmp }, [bmp])
        })
      } catch (err) {
        console.warn('Frame capture error:', err)
      }
    }, 33)

    setStatus('capturing')
  }, [videoRef])

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setStatus('ready')
  }, [])

  useEffect(() => {
    const worker = new Worker('/workers/gesture.worker.js')
    workerRef.current = worker
    setStatus('initialising')

    worker.onmessage = (e) => {
      const { type } = e.data

      if (type === 'READY') {
        setStatus('ready')
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
          onBufferFull([...bufferRef.current])
        }
      }
    }

    worker.postMessage({ type: 'INIT' })

    return () => {
      stopCapture()
      worker.terminate()
    }
  }, [onBufferFull, stopCapture])

  useEffect(() => {
    if (!active) {
      stopCapture()
      return
    }
    if (status === 'ready') {
      startCapture()
    }
  }, [active, status, startCapture, stopCapture])

  return { status, confidence, handsDetected, startCapture, stopCapture }
}
