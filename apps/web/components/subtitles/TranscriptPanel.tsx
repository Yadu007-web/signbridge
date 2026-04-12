'use client'
import { useEffect, useRef } from 'react'
import { TranscriptEntry } from '@/lib/subtitles/types'

interface Props {
  transcript: TranscriptEntry[]
  onClear:    () => void
  onClose:    () => void
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function downloadSRT(transcript: TranscriptEntry[]) {
  const lines = transcript.map((entry, i) => {
    const start = new Date(entry.timestamp)
    const end   = new Date(entry.timestamp + 3000)
    const fmt   = (d: Date) =>
      `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')},000`
    return `${i + 1}\n${fmt(start)} --> ${fmt(end)}\n[${entry.participantName}]: ${entry.gloss}\n`
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `signbridge-transcript-${Date.now()}.srt`
  a.click()
  URL.revokeObjectURL(url)
}

export function TranscriptPanel({ transcript, onClear, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  return (
    <div style={{
      position:      'absolute',
      top:           '60px',
      right:         '16px',
      bottom:        '80px',
      width:         '280px',
      background:    'rgba(0,0,0,0.9)',
      borderRadius:  '12px',
      border:        '1px solid #2a2a2a',
      zIndex:        15,
      display:       'flex',
      flexDirection: 'column',
      overflow:      'hidden',
    }}>
      <div style={{
        padding:        '10px 14px',
        borderBottom:   '1px solid #2a2a2a',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
          Transcript
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => downloadSRT(transcript)} style={{
            fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
            border: '1px solid #444', background: 'transparent', color: '#888', cursor: 'pointer',
          }}>Export</button>
          <button onClick={onClear} style={{
            fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
            border: '1px solid #444', background: 'transparent', color: '#888', cursor: 'pointer',
          }}>Clear</button>
          <button onClick={onClose} style={{
            fontSize: '13px', padding: '3px 8px', borderRadius: '6px',
            border: 'none', background: 'transparent', color: '#666', cursor: 'pointer',
          }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {transcript.length === 0 ? (
          <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '2rem' }}>
            Signed words will appear here
          </div>
        ) : (
          transcript.map(entry => (
            <div key={entry.id} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#555', marginBottom: '2px' }}>
                {formatTime(entry.timestamp)} · {entry.participantName}
                {entry.type === 'sign' ? ' (signing)' : ' (speaking)'}
              </div>
              <div style={{
                fontSize:     '14px',
                fontWeight:   600,
                color:        entry.type === 'sign' ? '#4ade80' : '#60a5fa',
                background:   'rgba(255,255,255,0.05)',
                borderRadius: '6px',
                padding:      '4px 8px',
              }}>
                {entry.gloss}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
