import type { AttendanceHistoryParams, AttendanceListParams, EmployeeListParams } from '@/types/api'

export const queryKeys = {
  me: ['me'] as const,
  serverTime: ['server-time'] as const,
  departments: ['departments'] as const,
  positions: (departmentId?: string) => ['positions', departmentId ?? 'all'] as const,
  employees: {
    all: ['employees'] as const,
    list: (params: EmployeeListParams) => ['employees', 'list', params] as const,
    detail: (id: string) => ['employees', 'detail', id] as const,
  },
  attendance: {
    all: ['attendance'] as const,
    schedule: ['attendance', 'schedule'] as const,
    today: ['attendance', 'today'] as const,
    mine: (params: AttendanceHistoryParams) => ['attendance', 'me', params] as const,
    list: (params: AttendanceListParams) => ['attendance', 'list', params] as const,
    detail: (id: string) => ['attendance', 'detail', id] as const,
    summary: (date?: string) => ['attendance', 'summary', date ?? 'today'] as const,
    stats: (days: number) => ['attendance', 'stats', days] as const,
    absentees: (date?: string) => ['attendance', 'absentees', date ?? 'today'] as const,
  },
}
