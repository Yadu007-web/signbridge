# SignBridge

Accessible video conferencing with real-time ASL sign language recognition.

## What it does
- Converts ASL signing into English subtitles in real time for all call participants
- Converts spoken English into sign language via a 3D avatar (toggle-activated)
- Full WCAG 2.1 AA accessibility compliance

## v1 Scope
- Sign language: American Sign Language (ASL)
- Platform: Web browser (Chrome, Firefox, Edge)
- Max room size: 10 participants
- Features: sign-to-subtitle, speech-to-sign avatar, transcript export

## Out of scope for v1
- Mobile app
- BSL, ISL or other sign languages
- Offline mode

## Success metrics
- Sign recognition accuracy: 82% target on WLASL test split
- Subtitle latency: under 300ms end-to-end
- Accessibility: zero axe-core critical violations
- Community rating: 4.0/5 from Deaf advisor testing

## Tech stack
- Frontend: Next.js 14, TypeScript, TailwindCSS
- Backend: FastAPI (Python 3.11)
- AI: MediaPipe Holistic, PyTorch, ONNX Runtime
- Real-time: LiveKit (WebRTC), Socket.IO
- Database: Supabase (PostgreSQL + Auth)
- Hosting: Vercel (frontend), Railway (API) — free tier

## Dataset
- Primary: WLASL (21,083 videos, 2,000 ASL signs)
- Gloss corpus: ASLG-PC12 (87,709 sentence pairs)

## Project status
- [x] Phase 1: Research & community foundation
- [ ] Phase 2: Environment setup & tooling
- [ ] Phase 3: Core WebRTC video conference
- [ ] Phase 4: Gesture capture pipeline
- [ ] Phase 5: Sign language recognition AI
- [ ] Phase 6: Subtitle system & bidirectional pipeline
- [ ] Phase 7: Testing & accessibility audit
- [ ] Phase 8: Deployment & launch
