'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase, getUserId } from '@/lib/supabase'
import { useWebRTC } from '@/lib/useWebRTC'
import type { Gender, Room } from '@/lib/supabase'

type AppState = 'lobby' | 'searching' | 'connected' | 'disconnected'

export default function ChatPage() {
  const [state, setState] = useState<AppState>('lobby')
  const [gender, setGender] = useState<Gender>('any')
  const [wants, setWants] = useState<Gender>('female')
  const [room, setRoom] = useState<Room | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const userId = useRef(getUserId())
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const onRemoteStream = useCallback((stream: MediaStream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream
    }
    setState('connected')
    setStatusMsg('')
  }, [])

  const onPeerDisconnected = useCallback(() => {
    setState('disconnected')
    setStatusMsg('Stranger disconnected.')
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }, [])

  const { hangup } = useWebRTC({
    room,
    userId: userId.current,
    localStream,
    onRemoteStream,
    onPeerDisconnected,
  })

  const startMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    setLocalStream(stream)
    if (localVideoRef.current) localVideoRef.current.srcObject = stream
    return stream
  }, [])

  const pollForMatch = useCallback((uid: string) => {
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        clearInterval(pollRef.current!)
        setRoom(data)
        setState('connected')
      }
    }, 1500)
  }, [])

  const startChat = useCallback(async () => {
    setState('searching')
    setStatusMsg('Looking for a stranger...')

    let stream = localStream
    if (!stream) stream = await startMedia()

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
  }, [localStream, gender, wants, startMedia, pollForMatch])

  const nextStranger = useCallback(async () => {
    hangup()
    if (room) {
      await supabase.from('rooms').delete().eq('id', room.id)
    }
    setRoom(null)
    setState('searching')
    setStatusMsg('Finding next stranger...')

    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId.current, gender, wants })
    })
    const data = await res.json()

    if (data.matched) {
      setRoom(data.room)
    } else {
      pollForMatch(userId.current)
    }
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight">chatte<span className="text-orange-500">.</span></span>
        <span className="text-xs text-white/40 uppercase tracking-widest">Random Video Chat</span>
      </header>

      {state === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Talk to strangers.</h1>
            <p className="text-white/50">Anonymous. Free. No signup.</p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-sm">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/50 uppercase tracking-widest">I am</label>
              <div className="flex gap-2">
                {(['male', 'female', 'any'] as Gender[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      gender === g
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-white/20 text-white/50 hover:border-white/40'
                    }`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/50 uppercase tracking-widest">I want to chat with</label>
              <div className="flex gap-2">
                {(['male', 'female', 'any'] as Gender[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setWants(g)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      wants === g
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-white/20 text-white/50 hover:border-white/40'
                    }`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startChat}
              className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition-all text-sm uppercase tracking-widest mt-2"
            >
              Start Chat
            </button>
          </div>

          <p className="text-xs text-white/20 text-center max-w-xs">
            By clicking Start, you agree to our terms. You must be 18+.
          </p>
        </div>
      )}

      {state !== 'lobby' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-zinc-900">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {(state === 'searching' || state === 'disconnected') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
                {state === 'searching' && (
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                )}
                <p className="text-white/70 text-sm">{statusMsg}</p>
              </div>
            )}

            <div className="absolute bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border border-white/20 bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 px-4 py-4 border-t border-white/10 bg-black">
            <button
              onClick={stopChat}
              className="px-6 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-sm transition-all"
            >
              Stop
            </button>
            <button
              onClick={nextStranger}
              className="px-8 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm uppercase tracking-widest transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
