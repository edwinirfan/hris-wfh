import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { env } from '@/config/env'
import { tokenStorage } from '@/lib/token-storage'
import type { AttendanceRecordedEvent } from '@/types/api'

interface UseRealtimeOptions {
  enabled?: boolean
  onAttendanceRecorded?: (event: AttendanceRecordedEvent) => void
}

/**
 * Koneksi Socket.IO ke namespace /realtime. Token dibaca ulang setiap
 * (re)connect sehingga tetap valid setelah access token di-refresh.
 */
export function useRealtime({ enabled = true, onAttendanceRecorded }: UseRealtimeOptions) {
  const [connected, setConnected] = useState(false)
  const handlerRef = useRef(onAttendanceRecorded)

  useEffect(() => {
    handlerRef.current = onAttendanceRecorded
  }, [onAttendanceRecorded])

  useEffect(() => {
    if (!enabled) return
    let retryTimer: number | undefined

    const socket = io(`${env.wsUrl}/realtime`, {
      auth: (cb) => cb({ token: tokenStorage.getAccessToken() }),
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 10_000,
    })

    socket.on('connect', () => setConnected(true))
    socket.on('connect_error', () => setConnected(false))
    socket.on('disconnect', (reason) => {
      setConnected(false)
      // diputus server (mis. token kedaluwarsa) → socket.io tidak reconnect otomatis
      if (reason === 'io server disconnect') {
        retryTimer = window.setTimeout(() => socket.connect(), 5_000)
      }
    })
    socket.on('attendance:recorded', (payload: AttendanceRecordedEvent) => handlerRef.current?.(payload))

    return () => {
      window.clearTimeout(retryTimer)
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [enabled])

  return { connected }
}
