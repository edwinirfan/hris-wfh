import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/api/attendance.api'
import { queryKeys } from '@/api/query-keys'

export function useTodayAttendance() {
  return useQuery({
    queryKey: queryKeys.attendance.today,
    queryFn: attendanceApi.today,
    staleTime: 30_000,
  })
}
