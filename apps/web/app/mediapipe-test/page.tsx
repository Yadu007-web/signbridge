'use client'
import { useEffect, useRef } from 'react'

export default function MediaPipeTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let animationId: number

    async function setup() {
      const { Hands } = await import('@mediapipe/hands')
      const { Camera } = await import('@mediapipe/camera_utils')
      const { drawConnectors, drawLandmarks } =
        await import('@mediapipe/drawing_utils')
      const { HAND_CONNECTIONS } = await import('@mediapipe/hands')

      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      })

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      })

      hands.onResults((results) => {
        const canvas = canvasRef.current
        const video = videoRef.current
        if (!canvas || !video) return
        const ctx = canvas.getContext('2d')!
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(results.image, 0, 0)
        if (results.multiHandLandmarks) {
          for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
              color: '#00FF00',
              lineWidth: 2,
            })
            drawLandmarks(ctx, landmarks, {
              color: '#FF0000',
              lineWidth: 1,
              radius: 4,
            })
          }
        }
      })

      if (videoRef.current) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await hands.send({ image: videoRef.current! })
          },
          width: 640,
          height: 480,
        })
        camera.start()
      }
    }

    setup()
    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>
        MediaPipe Hand Detection Test
      </h1>
      <p style={{ marginBottom: '1rem', color: '#666' }}>
        Hold your hand up to the camera — you should see green lines and red
        dots appear on your hand.
      </p>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas
          ref={canvasRef}
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            maxWidth: '100%',
          }}
        />
      </div>
    </div>
  )
}
