import { useQuery } from '@tanstack/react-query'
import { masterApi } from '@/api/employees.api'
import { queryKeys } from '@/api/query-keys'

export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.departments,
    queryFn: masterApi.departments,
    staleTime: 10 * 60_000,
  })
}

export function usePositions(departmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.positions(departmentId),
    queryFn: () => masterApi.positions(departmentId),
    enabled: !!departmentId,
    staleTime: 10 * 60_000,
  })
}
