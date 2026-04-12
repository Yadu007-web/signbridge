'use client'
import { SubtitleEvent } from '@/lib/subtitles/types'

interface Props {
  subtitles: SubtitleEvent[]
}

export function SubtitleOverlay({ subtitles }: Props) {
  if (subtitles.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        width: '90%',
        maxWidth: '700px',
        pointerEvents: 'none',
      }}
    >
      {subtitles.map((sub) => (
        <div
          key={sub.id}
          role="status"
          aria-live="polite"
          style={{
            background: 'rgba(0,0,0,0.85)',
            borderRadius: '10px',
            padding: '10px 20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>
            {sub.participantName} is signing
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: '#4ade80',
              letterSpacing: '0.05em',
            }}
          >
            {sub.gloss}
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
            {Math.round(sub.confidence * 100)}% confidence
          </div>
        </div>
      ))}
    </div>
  )
}
