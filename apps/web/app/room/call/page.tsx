'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useRef, useCallback, useState } from 'react'
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

function GestureOverlay() {
  const { localParticipant } = useLocalParticipant()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lastResult, setLastResult] = useState<string>('')
  const [isSignActive, setIsSignActive] = useState(true)

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
        setLastResult(data.predicted_gloss ?? '')
      } catch (err) {
        console.warn('Predict error:', err)
      }
    },
    [localParticipant]
  )

  const { status, confidence, handsDetected } = useGestureCapture(
    videoRef,
    handleBufferFull,
    isSignActive
  )

  return (
    <div
      style={{
        position: 'absolute',
        top: '70px',
        right: '16px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.75)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '12px',
          color: '#fff',
          minWidth: '180px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
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
          <span style={{ fontWeight: '500' }}>
            {status === 'initialising'
              ? 'Loading gesture AI...'
              : handsDetected
                ? 'Hands detected'
                : 'No hands detected'}
          </span>
        </div>

        {handsDetected && (
          <div style={{ color: '#aaa', fontSize: '11px', marginBottom: '4px' }}>
            Confidence: {Math.round(confidence * 100)}%
          </div>
        )}

        {lastResult && lastResult !== 'MODEL_NOT_TRAINED_YET' && (
          <div
            style={{
              marginTop: '6px',
              padding: '4px 8px',
              background: '#4ade80',
              color: '#000',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px',
            }}
          >
            {lastResult}
          </div>
        )}

        {lastResult === 'MODEL_NOT_TRAINED_YET' && handsDetected && (
          <div style={{ color: '#facc15', fontSize: '11px', marginTop: '4px' }}>
            Pipeline working — AI trains in Phase 5
          </div>
        )}
      </div>

      <button
        onClick={() => setIsSignActive((v) => !v)}
        style={{
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid #444',
          background: isSignActive ? '#4ade8022' : 'transparent',
          color: isSignActive ? '#4ade80' : '#888',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {isSignActive ? 'ASL capture ON' : 'ASL capture OFF'}
      </button>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: 'none' }}
      />
    </div>
  )
}

function CallRoom() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const room = params.get('room') ?? ''
  const name = params.get('name') ?? ''
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
        }}
      >
        <span style={{ color: '#fff', fontWeight: '600', fontSize: '1rem' }}>
          SignBridge
        </span>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>
          Room: {room} &nbsp;·&nbsp; {name}
        </span>
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

      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        video={true}
        audio={true}
        onDisconnected={() => router.push('/room')}
        style={{ height: 'calc(100vh - 53px)' }}
      >
        <VideoConference />
        <RoomAudioRenderer />
        <GestureOverlay />
      </LiveKitRoom>
    </div>
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
