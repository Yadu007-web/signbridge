'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useLocalParticipant,
} from '@livekit/components-react'
import {
  useGestureCapture,
  LandmarkFrame,
} from '@/lib/gesture/useGestureCapture'
import { useSubtitles } from '@/lib/subtitles/useSubtitles'
import { SubtitleOverlay } from '@/components/subtitles/SubtitleOverlay'
import { TranscriptPanel } from '@/components/subtitles/TranscriptPanel'

function CallInner() {
  const router = useRouter()
  const params = useSearchParams()
  const room = params.get('room') ?? ''
  const name = params.get('name') ?? ''

  const { localParticipant } = useLocalParticipant()

  const [isSignActive, setSignActive] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [lastStatus, setLastStatus] = useState('')

  const {
    activeSubtitles,
    transcript,
    broadcastSignSubtitle,
    clearTranscript,
  } = useSubtitles()

  const broadcastRef = useRef(broadcastSignSubtitle)
  const lastGlossRef = useRef<string>('')
  const lastGlossTimeRef = useRef<number>(0)
  const COOLDOWN_MS = 3000

  useEffect(() => {
    broadcastRef.current = broadcastSignSubtitle
  }, [broadcastSignSubtitle])

  const handleBufferFull = useCallback(
    async (frames: LandmarkFrame[]) => {
      try {
        const res = await fetch('http://localhost:8000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frames,
            participant_id: localParticipant?.identity ?? 'unknown',
          }),
        })
        const data = await res.json()

        if (data.status === 'ok' && data.predicted_gloss) {
          const now = Date.now()
          const gloss = data.predicted_gloss
          const sameSign = gloss === lastGlossRef.current
          const tooSoon = now - lastGlossTimeRef.current < COOLDOWN_MS

          if (sameSign && tooSoon) {
            const remaining = Math.ceil(
              (COOLDOWN_MS - (now - lastGlossTimeRef.current)) / 1000
            )
            setLastStatus(`Holding: ${gloss} — wait ${remaining}s`)
            return
          }

          lastGlossRef.current = gloss
          lastGlossTimeRef.current = now
          setLastStatus(
            `Recognised: ${gloss} (${Math.round(data.confidence * 100)}%)`
          )
          await broadcastRef.current(gloss, data.confidence)
        } else if (data.status === 'low_confidence') {
          setLastStatus(
            `Signing detected — confidence too low (${Math.round(data.confidence * 100)}%)`
          )
        } else if (data.status === 'no_model') {
          setLastStatus('Model not loaded — check FastAPI')
        }
      } catch {
        setLastStatus('API not reachable — is FastAPI running?')
      }
    },
    [localParticipant]
  )

  const { status, confidence, handsDetected } = useGestureCapture(
    handleBufferFull,
    isSignActive
  )

  return (
    <div
      style={{ height: '100vh', background: '#0f0f0f', position: 'relative' }}
    >
      <div
        style={{
          padding: '0.75rem 1.5rem',
          background: '#1a1a1a',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
          position: 'relative',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
          Sign<span style={{ color: '#4ade80' }}>Bridge</span>
        </span>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>
          Room: {room} &nbsp;·&nbsp; {name}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setShowTranscript((v) => !v)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              border: '1px solid #444',
              background: showTranscript ? '#4ade8022' : 'transparent',
              color: showTranscript ? '#4ade80' : '#ccc',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Transcript
          </button>
          <button
            onClick={() => router.push('/room')}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              border: '1px solid #444',
              background: 'transparent',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Leave
          </button>
        </div>
      </div>

      <div style={{ height: 'calc(100vh - 53px)', position: 'relative' }}>
        <VideoConference />
        <RoomAudioRenderer />

        <SubtitleOverlay subtitles={activeSubtitles} />

        {showTranscript && (
          <TranscriptPanel
            transcript={transcript}
            onClear={clearTranscript}
            onClose={() => setShowTranscript(false)}
          />
        )}

        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '16px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.75)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#fff',
              minWidth: '170px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: handsDetected
                    ? '#4ade80'
                    : status === 'initialising'
                      ? '#facc15'
                      : '#666',
                }}
              />
              <span style={{ fontWeight: 500 }}>
                {status === 'initialising'
                  ? 'Loading AI...'
                  : status === 'error'
                    ? 'Camera error'
                    : handsDetected
                      ? 'Hands detected'
                      : 'No hands detected'}
              </span>
            </div>
            {handsDetected && (
              <div style={{ color: '#aaa', fontSize: '11px' }}>
                Confidence: {Math.round(confidence * 100)}%
              </div>
            )}
            {lastStatus && (
              <div
                style={{ color: '#facc15', fontSize: '11px', marginTop: '4px' }}
              >
                {lastStatus}
              </div>
            )}
          </div>

          <button
            onClick={() => setSignActive((v) => !v)}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              border: '1px solid #444',
              background: isSignActive ? '#4ade8022' : 'transparent',
              color: isSignActive ? '#4ade80' : '#888',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {isSignActive ? 'ASL ON' : 'ASL OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CallRoom() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? ''

  if (!token || !livekitUrl) {
    return (
      <div style={{ color: '#fff', padding: '2rem', textAlign: 'center' }}>
        <p>Missing connection details.</p>
        <button
          onClick={() => router.push('/room')}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            background: '#4ade80',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      video={true}
      audio={true}
      onDisconnected={() => router.push('/room')}
      style={{ height: '100vh' }}
    >
      <CallInner />
    </LiveKitRoom>
  )
}

export default function CallPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100vh',
            background: '#0f0f0f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          Connecting...
        </div>
      }
    >
      <CallRoom />
    </Suspense>
  )
}
