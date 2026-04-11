import Link from 'next/link'

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f0f',
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1
        style={{
          fontSize: '3rem',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '1rem',
        }}
      >
        Sign<span style={{ color: '#4ade80' }}>Bridge</span>
      </h1>
      <p
        style={{
          color: '#888',
          fontSize: '1.1rem',
          maxWidth: '500px',
          marginBottom: '2.5rem',
          lineHeight: '1.6',
        }}
      >
        Video conferencing with real-time ASL sign language recognition. Sign —
        and everyone reads your words as subtitles.
      </p>
      <Link
        href="/room"
        style={{
          padding: '0.9rem 2.5rem',
          borderRadius: '10px',
          background: '#4ade80',
          color: '#000',
          fontWeight: '700',
          fontSize: '1.1rem',
          textDecoration: 'none',
          transition: 'opacity 0.2s',
        }}
      >
        Start a call
      </Link>
    </main>
  )
}
