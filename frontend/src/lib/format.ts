import dayjs from 'dayjs'
import 'dayjs/locale/id'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { env } from '@/config/env'
import type { EmploymentType, Gender, Role } from '@/types/api'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.locale('id')

export { dayjs }

export const TZ = env.timezone
export const DATE_FORMAT = 'YYYY-MM-DD'

/** Instant (ISO) → waktu di Asia/Jakarta */
export const inTz = (iso: string | number | Date) => dayjs(iso).tz(TZ)

/** Tanggal hari ini menurut WIB, dengan offset jam server bila ada */
export const todayInTz = (offsetMs = 0) => dayjs(Date.now() + offsetMs).tz(TZ).format(DATE_FORMAT)

export const daysAgoInTz = (days: number, offsetMs = 0) =>
  dayjs(Date.now() + offsetMs).tz(TZ).subtract(days, 'day').format(DATE_FORMAT)

/** Tanggal kalender (YYYY-MM-DD) — tidak dikonversi zona waktu */
export const formatDate = (date: string, pattern = 'ddd, DD MMM YYYY') => dayjs(date, DATE_FORMAT).format(pattern)

export const formatLongDate = (date: string) => dayjs(date, DATE_FORMAT).format('dddd, DD MMMM YYYY')

export const formatTime = (iso: string | null | undefined) => (iso ? inTz(iso).format('HH:mm') : '—')

export const formatTimeSeconds = (iso: string | null | undefined) => (iso ? inTz(iso).format('HH:mm:ss') : '—')

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? inTz(iso).format('DD MMM YYYY, HH:mm') : '—'

export const fromNow = (iso: string) => dayjs(iso).fromNow()

export const isInFuture = (iso: string | null | undefined) => !!iso && dayjs(iso).isAfter(dayjs())

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} mnt`
  return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export const formatPercent = (value: number) => `${Math.round(value * 100)}%`

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function greeting(offsetMs = 0): string {
  const hour = dayjs(Date.now() + offsetMs).tz(TZ).hour()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN_HR: 'Admin HR',
  EMPLOYEE: 'Karyawan',
}

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: 'Laki-laki',
  FEMALE: 'Perempuan',
}

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  PERMANENT: 'Tetap',
  CONTRACT: 'Kontrak',
  INTERN: 'Magang',
}
