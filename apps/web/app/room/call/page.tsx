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
import { useSpeechCapture } from '@/lib/gesture/useSpeechCapture'
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
  const [isSpeechActive, setSpeechActive] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [lastStatus, setLastStatus] = useState('')

  const {
    activeSubtitles,
    transcript,
    broadcastSignSubtitle,
    broadcastSpeechSubtitle,
    clearTranscript,
  } = useSubtitles()

  const broadcastSignRef = useRef(broadcastSignSubtitle)
  const broadcastSpeechRef = useRef(broadcastSpeechSubtitle)
  const lastGlossRef = useRef<string>('')
  const lastGlossTimeRef = useRef<number>(0)
  const lastSpeechRef = useRef<string>('')
  const COOLDOWN_MS = 3000

  useEffect(() => {
    broadcastSignRef.current = broadcastSignSubtitle
  }, [broadcastSignSubtitle])

  useEffect(() => {
    broadcastSpeechRef.current = broadcastSpeechSubtitle
  }, [broadcastSpeechSubtitle])

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
            setLastStatus(`Holding: ${gloss}`)
            return
          }
          lastGlossRef.current = gloss
          lastGlossTimeRef.current = now
          setLastStatus(
            `Signing: ${gloss} (${Math.round(data.confidence * 100)}%)`
          )
          await broadcastSignRef.current(gloss, data.confidence)
        } else if (data.status === 'low_confidence') {
          setLastStatus('Signing detected — keep signing clearly')
        } else if (data.status === 'no_model') {
          setLastStatus('Model not loaded — check FastAPI')
        }
      } catch {
        setLastStatus('API not reachable — is FastAPI running?')
      }
    },
    [localParticipant]
  )

  const handleTranscript = useCallback(
    async (text: string, isFinal: boolean) => {
      console.log('Speech received:', text, 'final:', isFinal)
      if (!isFinal) return
      if (text === lastSpeechRef.current) return
      lastSpeechRef.current = text
      console.log('Broadcasting speech:', text)
      await broadcastSpeechRef.current(text)
    },
    []
  )

  const { status, confidence, handsDetected } = useGestureCapture(
    handleBufferFull,
    isSignActive
  )

  const {
    listening,
    supported,
    error: speechError,
  } = useSpeechCapture(handleTranscript, isSpeechActive)

  const dotColor = handsDetected
    ? '#4ade80'
    : status === 'initialising'
      ? '#facc15'
      : '#555'

  return (
    <div
      style={{
        height: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, sans-serif',
        position: 'relative',
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          padding: '0 1.5rem',
          height: '52px',
          background: '#111',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 30,
        }}
      >
        {/* Left — logo + room */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg,#4ade80,#22c55e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            🤟
          </div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>
            Sign<span style={{ color: '#4ade80' }}>Bridge</span>
          </span>
          <span
            style={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '6px',
              padding: '2px 10px',
              fontSize: '11px',
              color: '#555',
            }}
          >
            {room}
          </span>
          <span style={{ fontSize: '11px', color: '#444' }}>· {name}</span>
        </div>

        {/* Right — controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* ASL toggle */}
          <button
            onClick={() => setSignActive((v) => !v)}
            title="Toggle ASL sign language recognition"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isSignActive ? '#4ade8066' : '#333',
              background: isSignActive ? '#4ade8011' : 'transparent',
              color: isSignActive ? '#4ade80' : '#555',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all .2s',
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: dotColor,
                transition: 'background .3s',
              }}
            />
            🤟 ASL {isSignActive ? 'ON' : 'OFF'}
          </button>

          {/* Speech toggle */}
          {supported && (
            <button
              onClick={() => {
                if (!isSpeechActive) {
                  setSpeechActive(true)
                } else {
                  setSpeechActive(false)
                }
              }}
              title={speechError || 'Click to start speech captions'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: speechError
                  ? '#ff444466'
                  : listening
                    ? '#60a5fa'
                    : isSpeechActive
                      ? '#60a5fa66'
                      : '#333',
                background: speechError
                  ? '#ff444411'
                  : listening
                    ? '#60a5fa22'
                    : isSpeechActive
                      ? '#60a5fa11'
                      : 'transparent',
                color: speechError
                  ? '#ff6666'
                  : listening
                    ? '#60a5fa'
                    : isSpeechActive
                      ? '#60a5fa'
                      : '#555',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all .2s',
              }}
            >
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: speechError
                    ? '#ff4444'
                    : listening
                      ? '#60a5fa'
                      : '#555',
                  animation: listening ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              🎤{' '}
              {speechError
                ? 'Mic Error'
                : listening
                  ? 'Listening...'
                  : isSpeechActive
                    ? 'Speech ON'
                    : 'Speech OFF'}
            </button>
          )}

          {/* Transcript */}
          <button
            onClick={() => setShowTranscript((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: showTranscript ? '#a78bfa66' : '#333',
              background: showTranscript ? '#a78bfa11' : 'transparent',
              color: showTranscript ? '#a78bfa' : '#555',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            📝 Transcript
            {transcript.length > 0 && (
              <span
                style={{
                  marginLeft: '4px',
                  background: '#a78bfa',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0 6px',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                {transcript.length}
              </span>
            )}
          </button>

          {/* Divider */}
          <div
            style={{ width: '1px', height: '20px', background: '#2a2a2a' }}
          />

          {/* Leave */}
          <button
            onClick={() => router.push('/room')}
            style={{
              padding: '5px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#3a0a0a',
              color: '#ff6666',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background .2s',
            }}
            onMouseEnter={(e) =>
              ((e.target as HTMLButtonElement).style.background = '#ff2222')
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLButtonElement).style.background = '#3a0a0a')
            }
          >
            Leave
          </button>
        </div>
      </div>

      {/* ── Video area ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <style>{`@keyframes pulse {0%, 100% { opacity: 1; }50% { opacity: 0.3; }}`}</style>
        <VideoConference />
        <RoomAudioRenderer />

        {/* Subtitle overlay */}
        <SubtitleOverlay subtitles={activeSubtitles} />

        {/* Transcript panel */}
        {showTranscript && (
          <TranscriptPanel
            transcript={transcript}
            onClear={clearTranscript}
            onClose={() => setShowTranscript(false)}
          />
        )}

        {/* Speech error pill */}
        {speechError && (
          <div
            style={{
              position: 'absolute',
              bottom: '116px',
              left: '16px',
              background: 'rgba(255,68,68,0.15)',
              border: '1px solid #ff444433',
              borderRadius: '20px',
              padding: '5px 14px',
              fontSize: '12px',
              color: '#ff6666',
              zIndex: 10,
            }}
          >
            🎤 {speechError}
          </div>
        )}

        {/* Status pill */}
        {lastStatus && (
          <div
            style={{
              position: 'absolute',
              bottom: '80px',
              left: '16px',
              background: 'rgba(0,0,0,0.7)',
              borderRadius: '20px',
              padding: '5px 14px',
              fontSize: '12px',
              color: '#facc15',
              zIndex: 10,
              maxWidth: '300px',
            }}
          >
            {lastStatus}
          </div>
        )}

        {/* Hand confidence pill */}
        {handsDetected && isSignActive && (
          <div
            style={{
              position: 'absolute',
              bottom: '48px',
              left: '16px',
              background: 'rgba(0,0,0,0.6)',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '11px',
              color: '#4ade80',
              zIndex: 10,
            }}
          >
            ✋ {Math.round(confidence * 100)}% confidence
          </div>
        )}

        {/* ASL loading indicator */}
        {status === 'initialising' && isSignActive && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '16px',
              background: 'rgba(0,0,0,0.7)',
              borderRadius: '20px',
              padding: '5px 14px',
              fontSize: '12px',
              color: '#facc15',
              zIndex: 10,
            }}
          >
            ⏳ Loading gesture AI...
          </div>
        )}
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
      <div
        style={{
          color: '#fff',
          padding: '2rem',
          textAlign: 'center',
          background: '#0a0a0a',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ marginBottom: '1rem', color: '#888' }}>
          Missing connection details.
        </p>
        <button
          onClick={() => router.push('/room')}
          style={{
            padding: '0.6rem 1.5rem',
            borderRadius: '8px',
            background: '#4ade80',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Go back to lobby
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
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            fontSize: '14px',
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
