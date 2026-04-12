export interface SubtitleEvent {
  type: 'sign_subtitle' | 'speech_subtitle'
  gloss: string
  confidence: number
  participantId: string
  participantName: string
  timestamp: number
  id: string
}

export interface TranscriptEntry {
  id: string
  gloss: string
  confidence: number
  participantName: string
  timestamp: number
  type: 'sign' | 'speech'
}
