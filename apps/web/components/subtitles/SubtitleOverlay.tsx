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
        bottom: '90px',
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
      {subtitles.map((sub) => {
        const isSign = sub.type === 'sign_subtitle'
        const color = isSign ? '#4ade80' : '#60a5fa'
        const label = isSign ? 'signing' : 'speaking'
        return (
          <div
            key={sub.id}
            role="status"
            aria-live="polite"
            style={{
              background: 'rgba(0,0,0,0.88)',
              borderRadius: '12px',
              padding: '10px 22px',
              textAlign: 'center',
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div
              style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}
            >
              {sub.participantName} is {label}
            </div>
            <div
              style={{
                fontSize: isSign ? '1.7rem' : '1.2rem',
                fontWeight: 700,
                color,
                letterSpacing: isSign ? '0.05em' : '0.01em',
                lineHeight: 1.3,
              }}
            >
              {sub.gloss}
            </div>
            {isSign && (
              <div
                style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}
              >
                {Math.round(sub.confidence * 100)}% confidence
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
