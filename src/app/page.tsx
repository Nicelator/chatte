'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'
import { useWebRTC } from '@/lib/useWebRTC'
import type { Gender, Room } from '@/lib/supabase'

type AppState = 'lobby' | 'permission' | 'searching' | 'connected' | 'disconnected' | 'error'

export default function ChatPage() {
  const [state, setState] = useState<AppState>('lobby')
  const [gender, setGender] = useState<Gender>('any')
  const [wants, setWants] = useState<Gender>('female')
  const [room, setRoom] = useState<Room | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const userId = useRef(getUserId())
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const onRemoteStream = useCallback((stream: MediaStream) => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
    setState('connected')
    setStatusMsg('')
  }, [])

  const onPeerDisconnected = useCallback(() => {
    setState('disconnected')
    setStatusMsg('Stranger left the chat.')
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }, [])

  const { hangup } = useWebRTC({
    room,
    userId: userId.current,
    localStream,
    onRemoteStream,
    onPeerDisconnected,
  })

  // Attach stream to local video whenever stream or state changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, state])

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      })
      setLocalStream(stream)
      return stream
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMsg('Camera and microphone access was denied. Please allow access in your browser settings and try again.')
      } else if (error.name === 'NotFoundError') {
        setErrorMsg('No camera or microphone found on this device.')
      } else {
        setErrorMsg('Could not access your camera. Please check your browser settings.')
      }
      setState('error')
      return null
    }
  }, [])

  const pollForMatch = useCallback((uid: string) => {
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        clearInterval(pollRef.current!)
        setRoom(data)
        setState('connected')
      }
    }, 1500)
  }, [])

  const handlePermissionAndStart = useCallback(async () => {
    const stream = await requestPermission()
    if (!stream) return

    setState('searching')
    setStatusMsg('Finding someone for you...')

    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId.current, gender, wants })
    })
    const data = await res.json()
    if (data.matched) {
      setRoom(data.room)
      setState('connected')
    } else {
      pollForMatch(userId.current)
    }
  }, [requestPermission, gender, wants, pollForMatch])

  const nextStranger = useCallback(async () => {
    hangup()
    if (room) await supabase.from('rooms').delete().eq('id', room.id)
    setRoom(null)
    setState('searching')
    setStatusMsg('Finding someone new...')
    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId.current, gender, wants })
    })
    const data = await res.json()
    if (data.matched) setRoom(data.room)
    else pollForMatch(userId.current)
  }, [hangup, room, gender, wants, pollForMatch])

  const stopChat = useCallback(async () => {
    hangup()
    clearInterval(pollRef.current!)
    if (room) await supabase.from('rooms').delete().eq('id', room.id)
    await fetch('/api/match', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId.current })
    })
    setRoom(null)
    setState('lobby')
    setStatusMsg('')
  }, [hangup, room])

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current!)
      localStream?.getTracks().forEach(t => t.stop())
    }
  }, [localStream])

  const inChat = state === 'searching' || state === 'connected' || state === 'disconnected'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0e0e12; }
        .pill-btn {
          flex: 1; padding: 10px 0; border-radius: 100px;
          font-size: 14px; font-weight: 600;
          border: 1.5px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.45); background: transparent;
          cursor: pointer; transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .pill-btn:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
        .pill-btn.active {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          border-color: transparent; color: #fff;
          box-shadow: 0 4px 20px rgba(139,92,246,0.4);
        }
        .start-btn {
          width: 100%; padding: 16px; border-radius: 100px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: #fff; font-size: 16px; font-weight: 700;
          border: none; cursor: pointer; letter-spacing: 0.5px;
          box-shadow: 0 8px 32px rgba(139,92,246,0.45); transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .start-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 40px rgba(139,92,246,0.55); }
        .next-btn {
          flex: 1; padding: 14px; border-radius: 100px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: #fff; font-size: 15px; font-weight: 700;
          border: none; cursor: pointer;
          box-shadow: 0 4px 20px rgba(139,92,246,0.4); transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .next-btn:hover { transform: translateY(-1px); }
        .stop-btn {
          padding: 14px 28px; border-radius: 100px;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
          font-size: 15px; font-weight: 600;
          border: 1.5px solid rgba(255,255,255,0.08);
          cursor: pointer; transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .stop-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
        .ghost-btn {
          width: 100%; padding: 14px; border-radius: 100px;
          background: transparent; color: rgba(255,255,255,0.4);
          font-size: 15px; font-weight: 600;
          border: 1.5px solid rgba(255,255,255,0.1);
          cursor: pointer; transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .ghost-btn:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
        .spinner {
          width: 36px; height: 36px;
          border: 3px solid rgba(139,92,246,0.2);
          border-top-color: #8b5cf6; border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .glow-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #8b5cf6; box-shadow: 0 0 8px #8b5cf6;
          animation: pulse 2s ease infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .perm-icon {
          width: 80px; height: 80px; border-radius: 24px;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 36px; margin: 0 auto 28px;
        }
        .perm-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .perm-dot {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          background: rgba(139,92,246,0.15);
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
      `}</style>

      <div style={{ minHeight: '100svh', background: '#0e0e12', color: '#fff', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="glow-dot" />
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
              chatte<span style={{ color: '#8b5cf6' }}>.</span>
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Video Chat</span>
        </header>

        {/* Always-mounted hidden local video — keeps ref alive across state changes */}
        <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />

        {/* Lobby */}
        {state === 'lobby' && (
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ display: 'inline-block', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 100, padding: '6px 16px', fontSize: 12, fontWeight: 600, color: '#a78bfa', marginBottom: 20, letterSpacing: '0.5px' }}>✦ Free & Anonymous</div>
              <h1 style={{ fontSize: 'clamp(32px, 8vw, 52px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px', marginBottom: 12 }}>
                Meet someone<br />
                <span style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>interesting.</span>
              </h1>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Random video chats with real people.</p>
            </div>

            <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '20px 20px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>I am</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['male', 'female', 'any'] as Gender[]).map(g => (
                    <button key={g} className={`pill-btn${gender === g ? ' active' : ''}`} onClick={() => setGender(g)}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '20px 20px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>I want to chat with</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['male', 'female', 'any'] as Gender[]).map(g => (
                    <button key={g} className={`pill-btn${wants === g ? ' active' : ''}`} onClick={() => setWants(g)}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button className="start-btn" onClick={() => setState('permission')}>Start Chatting ✦</button>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.18)', fontWeight: 500 }}>By continuing you agree to our terms · 18+ only</p>
            </div>
          </div>
        )}

        {/* Permission screen */}
        {state === 'permission' && (
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 48px' }}>
            <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="perm-icon">🎥</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>Allow Camera & Mic</h2>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>Chatte needs access to your camera and microphone to connect you with strangers.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="perm-row">
                  <div className="perm-dot">📷</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Camera</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>So others can see you</p>
                  </div>
                </div>
                <div className="perm-row">
                  <div className="perm-dot">🎙️</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Microphone</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>So others can hear you</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <button className="start-btn" onClick={handlePermissionAndStart}>Allow & Start Chatting</button>
                <button className="ghost-btn" onClick={() => setState('lobby')}>Go Back</button>
              </div>

              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>Your camera is only active during a chat session. We never record or store your video.</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📷</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Camera Access Needed</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 300, lineHeight: 1.6, marginBottom: 32 }}>{errorMsg}</p>
            <button className="start-btn" style={{ maxWidth: 280 }} onClick={() => setState('lobby')}>Go Back</button>
          </div>
        )}

        {/* Chat view */}
        {inChat && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative', background: '#080810', overflow: 'hidden' }}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

              {(state === 'searching' || state === 'disconnected') && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,18,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, backdropFilter: 'blur(8px)' }}>
                  {state === 'searching' && <div className="spinner" />}
                  {state === 'disconnected' && <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👋</div>}
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{statusMsg}</p>
                  {state === 'disconnected' && (
                    <button className="next-btn" style={{ marginTop: 8, padding: '12px 32px', flex: 'none' }} onClick={nextStranger}>Find someone new</button>
                  )}
                </div>
              )}

              {/* Local video PiP — visible in chat */}
              <div style={{ position: 'absolute', bottom: 16, right: 16, width: 90, height: 120, borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(139,92,246,0.4)', background: '#0e0e12', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <video
                  autoPlay playsInline muted
                  ref={(el) => {
                    if (el && localStream) el.srcObject = localStream
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
              </div>

              {state === 'connected' && (
                <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(14,14,18,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 100, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="glow-dot" style={{ width: 6, height: 6 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Connected</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button className="stop-btn" onClick={stopChat}>Stop</button>
              <button className="next-btn" onClick={nextStranger}>Next stranger →</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}