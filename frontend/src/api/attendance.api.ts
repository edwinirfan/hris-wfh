import { apiGet, apiPost } from '@/lib/api-client'
import type {
  Absentee,
  AttendanceDetail,
  AttendanceHistoryParams,
  AttendanceListParams,
  AttendanceRecord,
  AttendanceStats,
  AttendanceSummary,
  AttendanceType,
  Paginated,
  Schedule,
  TodayAttendance,
} from '@/types/api'

export interface AttendanceSubmission {
  type: AttendanceType
  photo: Blob
  faceCount: number
  faceConfidence: number
  livenessPassed: boolean
  clientTime: string
  location?: { latitude: number; longitude: number; accuracy: number }
  note?: string
}

/** Field multipart sesuai docs/API.md */
function toFormData(input: AttendanceSubmission): FormData {
  const form = new FormData()
  form.append('photo', input.photo, `selfie-${Date.now()}.jpg`)
  form.append('faceCount', String(input.faceCount))
  form.append('faceConfidence', input.faceConfidence.toFixed(4))
  form.append('livenessPassed', String(input.livenessPassed))
  form.append('clientTime', input.clientTime)
  if (input.location) {
    form.append('latitude', input.location.latitude.toFixed(7))
    form.append('longitude', input.location.longitude.toFixed(7))
    form.append('accuracy', input.location.accuracy.toFixed(2))
  }
  const note = input.note?.trim()
  if (note) form.append('note', note)
  return form
}

export const attendanceApi = {
  schedule: () => apiGet<Schedule>('/attendance/schedule'),
  today: () => apiGet<TodayAttendance>('/attendance/today'),
  submit: (input: AttendanceSubmission) =>
    apiPost<AttendanceDetail>(
      input.type === 'CHECK_IN' ? '/attendance/check-in' : '/attendance/check-out',
      toFormData(input),
    ),
  mine: (params: AttendanceHistoryParams) => apiGet<Paginated<AttendanceRecord>>('/attendance/me', { params }),
  detail: (id: string) => apiGet<AttendanceDetail>(`/attendance/${id}`),
  list: (params: AttendanceListParams) => apiGet<Paginated<AttendanceRecord>>('/attendance', { params }),
  summary: (date?: string) =>
    apiGet<AttendanceSummary>('/attendance/summary', { params: date ? { date } : undefined }),
  stats: (days: number) => apiGet<AttendanceStats>('/attendance/stats', { params: { days } }),
  absentees: (date?: string) =>
    apiGet<Absentee[]>('/attendance/absentees', { params: date ? { date } : undefined }),
}
