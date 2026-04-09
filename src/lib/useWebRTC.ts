'use client'
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/lib/supabase'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

interface UseWebRTCProps {
  room: Room | null
  userId: string
  localStream: MediaStream | null
  onRemoteStream: (stream: MediaStream) => void
  onPeerDisconnected: () => void
}

export function useWebRTC({
  room,
  userId,
  localStream,
  onRemoteStream,
  onPeerDisconnected,
}: UseWebRTCProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const sendSignal = useCallback(async (
    type: string,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, never>,
    toUser: string,
    roomId: string
  ) => {
    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, from_user: userId, to_user: toUser, type, payload })
    })
  }, [userId])

  useEffect(() => {
    if (!room || !localStream) return

    const peerId = room.user_a === userId ? room.user_b : room.user_a
    const isInitiator = room.user_a === userId

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream))

    pc.ontrack = (event) => {
      onRemoteStream(event.streams[0])
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', event.candidate.toJSON(), peerId, room.id)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        onPeerDisconnected()
      }
    }

    const channel = supabase
      .channel(`room:${room.id}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signals',
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          const signal = payload.new as {
            to_user: string
            from_user: string
            type: string
            payload: RTCSessionDescriptionInit & { candidate?: RTCIceCandidateInit }
          }
          if (signal.to_user !== userId) return

          if (signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendSignal('answer', answer, peerId, room.id)
          } else if (signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload))
          } else if (signal.type === 'ice-candidate' && signal.payload.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload.candidate))
          } else if (signal.type === 'bye') {
            onPeerDisconnected()
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    if (isInitiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer)
        sendSignal('offer', offer, peerId, room.id)
      })
    }

    return () => {
      pc.close()
      channel.unsubscribe()
      pcRef.current = null
    }
  }, [room, localStream, userId, sendSignal, onRemoteStream, onPeerDisconnected])

  const hangup = useCallback(() => {
    if (!room) return
    const peerId = room.user_a === userId ? room.user_b : room.user_a
    sendSignal('bye', {}, peerId, room.id)
    pcRef.current?.close()
    channelRef.current?.unsubscribe()
  }, [room, userId, sendSignal])

  return { hangup }
}