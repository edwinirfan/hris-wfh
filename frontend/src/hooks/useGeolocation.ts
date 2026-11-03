import { useEffect, useState } from 'react'

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number
}

export type GeoStatus = 'pending' | 'granted' | 'denied' | 'unavailable'

/** Lokasi bersifat opsional — bila ditolak/tidak tersedia, absen tetap bisa dilakukan */
export function useGeolocation(enabled = true) {
  const [status, setStatus] = useState<GeoStatus>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'pending' : 'unavailable',
  )
  const [position, setPosition] = useState<GeoPosition | null>(null)

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setStatus('granted')
      },
      (error) => {
        if (cancelled) return
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { status, position }
}
