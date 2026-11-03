import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { timeApi } from '@/api/auth.api'
import { queryKeys } from '@/api/query-keys'

interface ServerClock {
  offsetMs: number
  timezone: string
}

/** Offset = jam server − jam lokal, dengan koreksi setengah round-trip */
async function measureOffset(): Promise<ServerClock> {
  const sentAt = Date.now()
  const res = await timeApi.now()
  const receivedAt = Date.now()
  return { offsetMs: res.epochMs - (sentAt + receivedAt) / 2, timezone: res.timezone }
}

/**
 * Jam yang tampil di UI mengikuti jam server, bukan jam perangkat
 * (jam perangkat bisa diubah pengguna). Disinkron ulang tiap 5 menit.
 */
export function useServerTime() {
  const query = useQuery({
    queryKey: queryKeys.serverTime,
    queryFn: measureOffset,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
  const offsetMs = query.data?.offsetMs ?? 0
  const now = useCallback(() => Date.now() + offsetMs, [offsetMs])
  return { offsetMs, synced: query.isSuccess, now }
}
