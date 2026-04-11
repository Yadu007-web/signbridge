'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LobbyPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [room, setRoom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    if (!name.trim() || !room.trim()) {
      setError('Please enter both your name and a room name')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:8000/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: room.trim(),
          participant_name: name.trim(),
        }),
      })
      const data = await res.json()
      if (!data.token) throw new Error('No token received')
      const params = new URLSearchParams({
        token: data.token,
        room: room.trim(),
        name: name.trim(),
      })
      router.push(`/room/call?${params.toString()}`)
    } catch (err) {
      setError('Could not connect. Make sure the API server is running.')
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f0f',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '16px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '0.5rem',
            }}
          >
            SignBridge
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Accessible video calls with real-time ASL subtitles
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              color: '#ccc',
              fontSize: '0.85rem',
              marginBottom: '0.4rem',
            }}
          >
            Your name
          </label>
          <input
            type="text"
            placeholder="e.g. Yadu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #333',
              background: '#111',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              color: '#ccc',
              fontSize: '0.85rem',
              marginBottom: '0.4rem',
            }}
          >
            Room name
          </label>
          <input
            type="text"
            placeholder="e.g. my-meeting"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #333',
              background: '#111',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <p
            style={{
              color: '#ff6b6b',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={handleJoin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.85rem',
            borderRadius: '8px',
            border: 'none',
            background: loading ? '#333' : '#4ade80',
            color: loading ? '#888' : '#000',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Joining...' : 'Join call'}
        </button>
      </div>
    </main>
  )
}
