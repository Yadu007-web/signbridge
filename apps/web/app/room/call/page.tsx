'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react'

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

  function handleDisconnected() {
    router.push('/room')
  }

  return (
    <div style={{ height: '100vh', background: '#0f0f0f' }}>
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
          onClick={handleDisconnected}
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
        onDisconnected={handleDisconnected}
        style={{ height: 'calc(100vh - 53px)' }}
      >
        <VideoConference />
        <RoomAudioRenderer />
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
