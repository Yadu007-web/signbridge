'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocalParticipant, useRoomContext } from '@livekit/components-react'
import { SubtitleEvent, TranscriptEntry } from './types'

const SUBTITLE_DISPLAY_MS = 4000
const MIN_CONFIDENCE = 0.35

export function useSubtitles() {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const roomRef = useRef(room)
  const participantRef = useRef(localParticipant)

  const [activeSubtitles, setActiveSubtitles] = useState<SubtitleEvent[]>([])
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  useEffect(() => {
    roomRef.current = room
  }, [room])
  useEffect(() => {
    participantRef.current = localParticipant
  }, [localParticipant])

  const showSubtitle = useCallback((event: SubtitleEvent) => {
    setActiveSubtitles((prev) => {
      const filtered = prev.filter(
        (s) => s.participantId !== event.participantId
      )
      return [...filtered, event]
    })
    setTranscript((prev) => [
      ...prev,
      {
        id: event.id,
        gloss: event.gloss,
        confidence: event.confidence,
        participantName: event.participantName,
        timestamp: event.timestamp,
        type: event.type === 'sign_subtitle' ? 'sign' : 'speech',
      },
    ])
    const existing = timeoutsRef.current.get(event.participantId)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => {
      setActiveSubtitles((prev) => prev.filter((s) => s.id !== event.id))
      timeoutsRef.current.delete(event.participantId)
    }, SUBTITLE_DISPLAY_MS)
    timeoutsRef.current.set(event.participantId, t)
  }, [])

  useEffect(() => {
    const r = roomRef.current
    if (!r) return
    function handleData(payload: Uint8Array) {
      try {
        const event = JSON.parse(
          new TextDecoder().decode(payload)
        ) as SubtitleEvent
        if (event.type !== 'sign_subtitle' && event.type !== 'speech_subtitle')
          return
        if (!event.gloss) return
        showSubtitle(event)
      } catch {
        /* ignore */
      }
    }
    r.on('dataReceived', handleData)
    return () => {
      r.off('dataReceived', handleData)
    }
  }, [showSubtitle])

  const broadcastSignSubtitle = useCallback(
    async (gloss: string, confidence: number) => {
      const r = roomRef.current
      const p = participantRef.current
      if (!r || !p) return
      if (confidence < MIN_CONFIDENCE) return
      if (!gloss || gloss === 'unknown') return

      const event: SubtitleEvent = {
        type: 'sign_subtitle',
        gloss: gloss.toUpperCase(),
        confidence,
        participantId: p.identity,
        participantName: p.name ?? p.identity,
        timestamp: Date.now(),
        id: `${p.identity}-${Date.now()}`,
      }

      const payload = new TextEncoder().encode(JSON.stringify(event))
      try {
        await r.localParticipant.publishData(payload, {
          reliable: true,
        })
      } catch (err) {
        console.warn('Broadcast error:', err)
      }

      showSubtitle(event)
    },
    [showSubtitle]
  )

  const clearTranscript = useCallback(() => setTranscript([]), [])

  return { activeSubtitles, transcript, broadcastSignSubtitle, clearTranscript }
}
