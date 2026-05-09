'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

const SIGNS = [
  { word: 'HELLO', hint: 'Open hand — wave outward from forehead' },
  { word: 'GOODBYE', hint: 'Open hand — wave side to side' },
  { word: 'THANK_YOU', hint: 'Flat hand from chin — move forward' },
  { word: 'PLEASE', hint: 'Flat hand — circular motion on chest' },
  { word: 'SORRY', hint: 'Fist — circular motion on chest' },
  { word: 'YES', hint: 'Fist — nod up and down' },
  { word: 'NO', hint: 'Index + middle finger tap thumb twice' },
  { word: 'HELP', hint: 'Fist on open palm — lift both hands up' },
  { word: 'STOP', hint: 'One hand chops down on other palm' },
  { word: 'UNDERSTAND', hint: 'Index finger flicks up from forehead' },
  { word: 'NAME', hint: 'Two H-hands tap together twice' },
  { word: 'WHAT', hint: 'Index finger sweeps across other fingers' },
  { word: 'WHERE', hint: 'Index finger waves side to side' },
  { word: 'WHO', hint: 'Index finger circles in front of mouth' },
  { word: 'WHEN', hint: 'Index fingers circle then touch tips' },
  { word: 'MUTE', hint: 'Two fingers pinch together at mouth' },
  { word: 'WAIT', hint: 'Both hands wiggle fingers facing up' },
  { word: 'REPEAT', hint: 'Dominant hand circles over other hand' },
  { word: 'SLOW', hint: 'One hand slides slowly up other forearm' },
  { word: 'GOOD', hint: 'Flat hand from mouth — forward and down' },
]

const NUM_FRAMES = 60
const FRAME_MS = 33
const REPS_NEEDED = 15
const INPUT_DIM = 63

export default function RecordPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handsRef = useRef<unknown>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bufferRef = useRef<number[][]>([])
  const recordingRef = useRef(false)
  const allDataRef = useRef<Record<string, number[][][]>>({})

  const [signIdx, setSignIdx] = useState(0)
  const [repsDone, setRepsDone] = useState(0)
  const [status, setStatus] = useState('Loading MediaPipe...')
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [ready, setReady] = useState(false)
  const [handsVisible, setHandsVisible] = useState(false)
  const [done, setDone] = useState(false)

  const loadScript = useCallback(
    (src: string) =>
      new Promise<void>((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          res()
          return
        }
        const s = document.createElement('script')
        s.src = src
        s.onload = () => res()
        s.onerror = () => rej(new Error(`Failed: ${src}`))
        document.head.appendChild(s)
      }),
    []
  )

  useEffect(() => {
    const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915'
    let mounted = true

    async function init() {
      try {
        setStatus('Loading MediaPipe...')
        await loadScript(`${CDN}/hands.js`)
        if (!mounted) return

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        const video = videoRef.current!
        video.srcObject = stream
        video.autoplay = true
        video.muted = true
        await video.play()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const H = (window as any).Hands
        const hands = new H({ locateFile: (f: string) => `${CDN}/${f}` })

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hands.onResults((results: any) => {
          const hasHands = results.multiHandLandmarks?.length > 0
          setHandsVisible(hasHands)
          if (!recordingRef.current || !hasHands) return

          const lm = results.multiHandLandmarks[0]
          const flat = lm.flatMap((p: { x: number; y: number; z: number }) => [
            p.x,
            p.y,
            p.z,
          ])
          bufferRef.current.push(flat)
          setFrameCount(bufferRef.current.length)

          if (bufferRef.current.length >= NUM_FRAMES) {
            const captured = bufferRef.current.slice(0, NUM_FRAMES)
            bufferRef.current = []
            recordingRef.current = false
            setRecording(false)

            // Save this rep
            const word = SIGNS[signIdx].word
            if (!allDataRef.current[word]) allDataRef.current[word] = []
            allDataRef.current[word].push(captured)

            setRepsDone((prev) => prev + 1)
            setStatus('✅ Saved! Rest a moment then record again.')
            setFrameCount(0)
          }
        })

        handsRef.current = hands
        await hands.initialize()
        if (!mounted) return

        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (hands as any).send({ image: videoRef.current })
        }, FRAME_MS)

        setReady(true)
        setStatus('Ready — press Record when your hand is visible')
      } catch (err) {
        console.error(err)
        setStatus('Error loading camera. Refresh and try again.')
      }
    }

    init()
    return () => {
      mounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loadScript, signIdx])

  function startRecording() {
    if (!ready || recording || repsDone >= REPS_NEEDED) return
    bufferRef.current = []
    setFrameCount(0)
    let c = 3
    setCountdown(c)
    setStatus('Get your hand ready...')

    const t = setInterval(() => {
      c--
      if (c > 0) {
        setCountdown(c)
      } else {
        clearInterval(t)
        setCountdown(0)
        recordingRef.current = true
        setRecording(true)
        setStatus('Signing now — hold the sign clearly!')
      }
    }, 1000)
  }

  function nextSign() {
    setRepsDone(0)
    setFrameCount(0)
    setStatus('Ready — press Record when your hand is visible')
    if (signIdx + 1 >= SIGNS.length) {
      setDone(true)
    } else {
      setSignIdx((s) => s + 1)
    }
  }

  function downloadData() {
    const output = {
      signs: allDataRef.current,
      metadata: {
        num_frames: NUM_FRAMES,
        input_dim: INPUT_DIM,
        num_signs: SIGNS.length,
        reps_per_sign: REPS_NEEDED,
        recorded_at: new Date().toISOString(),
        vocab: Object.fromEntries(
          Object.keys(allDataRef.current).map((k, i) => [k, i])
        ),
      },
    }
    const blob = new Blob([JSON.stringify(output)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'signbridge_landmarks.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentSign = SIGNS[signIdx]
  const signDone = repsDone >= REPS_NEEDED
  const progress = Math.round((signIdx / SIGNS.length) * 100)

  if (done) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#0f0f0f',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        <h1
          style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          All 20 signs recorded!
        </h1>
        <p
          style={{
            color: '#888',
            maxWidth: '480px',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          You recorded {REPS_NEEDED} examples of each sign —{' '}
          {SIGNS.length * REPS_NEEDED} total. Download the file and upload it to
          Kaggle to train your model.
        </p>
        <button
          onClick={downloadData}
          style={{
            padding: '1rem 2.5rem',
            borderRadius: '10px',
            border: 'none',
            background: '#4ade80',
            color: '#000',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Download signbridge_landmarks.json
        </button>
        <p style={{ color: '#555', fontSize: '12px', marginTop: '1rem' }}>
          File size will be around 15–25MB
        </p>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>
          Sign<span style={{ color: '#4ade80' }}>Bridge</span> Recording Studio
        </h1>
        <span style={{ color: '#888', fontSize: '12px' }}>
          Sign {signIdx + 1} of {SIGNS.length} &nbsp;·&nbsp; {progress}%
          complete
        </span>
      </div>

      {/* Overall progress bar */}
      <div
        style={{
          height: '4px',
          background: '#222',
          borderRadius: '2px',
          marginBottom: '1.5rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#4ade80',
            borderRadius: '2px',
            transition: 'width 0.3s',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        {/* Left — camera */}
        <div>
          <div style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: '100%',
                borderRadius: '12px',
                border: recording
                  ? '3px solid #4ade80'
                  : handsVisible
                    ? '3px solid #facc15'
                    : '3px solid #333',
                transform: 'scaleX(-1)',
                display: 'block',
              }}
            />

            {/* Hand indicator */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: handsVisible ? '#4ade80' : '#666',
                }}
              />
              {handsVisible ? 'Hand detected' : 'No hand'}
            </div>
          </div>

          {/* Countdown */}
          {countdown > 0 && (
            <div
              style={{
                textAlign: 'center',
                fontSize: '5rem',
                fontWeight: 700,
                color: '#facc15',
                marginTop: '0.5rem',
                lineHeight: 1,
              }}
            >
              {countdown}
            </div>
          )}

          {/* Recording progress bar */}
          {recording && (
            <div style={{ marginTop: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#4ade80',
                  marginBottom: '4px',
                }}
              >
                <span>Recording...</span>
                <span>
                  {frameCount}/{NUM_FRAMES} frames
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: '#333',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(frameCount / NUM_FRAMES) * 100}%`,
                    background: '#4ade80',
                    transition: 'width 0.05s',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right — instructions */}
        <div>
          {/* Sign info */}
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}
            >
              Sign {signIdx + 1} of {SIGNS.length}
            </div>
            <div
              style={{
                fontSize: '2.2rem',
                fontWeight: 700,
                color: '#4ade80',
                marginBottom: '0.5rem',
                letterSpacing: '0.02em',
              }}
            >
              {currentSign.word.replace(/_/g, ' ')}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#ccc',
                lineHeight: 1.6,
                marginBottom: '0.75rem',
              }}
            >
              {currentSign.hint}
            </div>
            <a
              href={`https://www.handspeak.com/word/${currentSign.word.toLowerCase().replace(/_/g, '-')}/`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#4ade80', fontSize: '12px' }}
            >
              Watch how to sign this on Handspeak →
            </a>
          </div>

          {/* Rep progress */}
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#888',
                marginBottom: '10px',
              }}
            >
              Recordings: {repsDone} / {REPS_NEEDED}
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {Array.from({ length: REPS_NEEDED }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: i < repsDone ? '#4ade80' : '#2a2a2a',
                    border: i < repsDone ? 'none' : '1px solid #444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: i < repsDone ? '#000' : '#555',
                    fontWeight: 500,
                  }}
                >
                  {i < repsDone ? '✓' : i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: status.startsWith('✅') ? '#4ade80' : '#888',
              marginBottom: '1rem',
              minHeight: '40px',
            }}
          >
            {status}
          </div>

          {/* Tips */}
          <div
            style={{
              background: '#111',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '11px',
              color: '#555',
              marginBottom: '1rem',
              lineHeight: 1.6,
            }}
          >
            💡 Tips: Centre your hand in frame · Good lighting · Sign slowly and
            clearly · Vary your speed slightly between reps
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={startRecording}
              disabled={!ready || recording || signDone}
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '8px',
                border: 'none',
                background:
                  !ready || recording || signDone ? '#222' : '#4ade80',
                color: !ready || recording || signDone ? '#555' : '#000',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor:
                  !ready || recording || signDone ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {!ready
                ? 'Loading...'
                : recording
                  ? `Recording ${frameCount}/${NUM_FRAMES}`
                  : signDone
                    ? 'All reps done!'
                    : `Record (${repsDone}/${REPS_NEEDED})`}
            </button>

            {signDone && (
              <button
                onClick={nextSign}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#6366f1',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {signIdx + 1 >= SIGNS.length
                  ? 'Finish & Download →'
                  : 'Next Sign →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
