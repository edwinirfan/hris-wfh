import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, LogOut, UserCheck, UserRoundX, Users, UserX } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { attendanceApi } from '@/api/attendance.api'
import { queryKeys } from '@/api/query-keys'
import { LiveClock } from '@/components/attendance/LiveClock'
import { PhotoViewer } from '@/components/attendance/PhotoViewer'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { AbsenteesList } from '@/features/hr/AbsenteesList'
import { AttendanceChart } from '@/features/hr/AttendanceChart'
import { RealtimeFeed, type FeedItem } from '@/features/hr/RealtimeFeed'
import { useRealtime } from '@/hooks/useRealtime'
import { formatLongDate, todayInTz } from '@/lib/format'
import type { AttendanceListParams, AttendanceRecord, AttendanceRecordedEvent } from '@/types/api'

const STATS_DAYS = 7
const FEED_LIMIT = 20

/** Record absensi → item feed (check-in, dan check-out bila ada) */
function recordToFeed(record: AttendanceRecord): FeedItem[] {
  const base = {
    attendanceId: record.id,
    fullName: record.employee.fullName,
    employeeCode: record.employee.employeeCode,
    departmentName: record.employee.departmentName,
    status: record.status,
    lateMinutes: record.lateMinutes,
  }
  const items: FeedItem[] = [
    { ...base, key: `${record.id}-CHECK_IN`, type: 'CHECK_IN', recordedAt: record.checkInAt, photoUrl: record.checkInPhotoUrl },
  ]
  if (record.checkOutAt) {
    items.push({
      ...base,
      key: `${record.id}-CHECK_OUT`,
      type: 'CHECK_OUT',
      recordedAt: record.checkOutAt,
      photoUrl: record.checkOutPhotoUrl,
    })
  }
  return items
}

export function MonitoringDashboardPage() {
  const queryClient = useQueryClient()
  const [liveItems, setLiveItems] = useState<FeedItem[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const today = todayInTz()

  const summary = useQuery({ queryKey: queryKeys.attendance.summary(), queryFn: () => attendanceApi.summary() })
  const stats = useQuery({ queryKey: queryKeys.attendance.stats(STATS_DAYS), queryFn: () => attendanceApi.stats(STATS_DAYS) })
  const absentees = useQuery({ queryKey: queryKeys.attendance.absentees(), queryFn: () => attendanceApi.absentees() })

  const feedParams: AttendanceListParams = { page: 1, limit: 10, from: today, to: today, sortBy: 'checkInAt', sortOrder: 'DESC' }
  const recent = useQuery({
    queryKey: queryKeys.attendance.list(feedParams),
    queryFn: () => attendanceApi.list(feedParams),
  })

  const onRecorded = useCallback(
    (event: AttendanceRecordedEvent) => {
      const item: FeedItem = {
        key: `${event.attendanceId}-${event.type}`,
        attendanceId: event.attendanceId,
        fullName: event.fullName,
        employeeCode: event.employeeCode,
        departmentName: event.departmentName,
        type: event.type,
        status: event.status,
        lateMinutes: event.lateMinutes,
        recordedAt: event.recordedAt,
        photoUrl: event.photoUrl,
        live: true,
      }
      setLiveItems((current) => [item, ...current.filter((i) => i.key !== item.key)].slice(0, FEED_LIMIT))
      toast(`${event.fullName} ${event.type === 'CHECK_IN' ? 'check-in' : 'check-out'}`, {
        description: event.departmentName,
      })
      for (const key of [
        queryKeys.attendance.summary(),
        queryKeys.attendance.absentees(),
        queryKeys.attendance.stats(STATS_DAYS),
        ['attendance', 'list'] as const,
      ]) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
    [queryClient],
  )
  const { connected } = useRealtime({ onAttendanceRecorded: onRecorded })

  // gabungkan data awal + event live, buang duplikat, urutkan terbaru di atas
  const feed = useMemo(() => {
    const merged = new Map<string, FeedItem>()
    for (const item of liveItems) merged.set(item.key, item)
    for (const record of recent.data?.items ?? []) {
      for (const item of recordToFeed(record)) if (!merged.has(item.key)) merged.set(item.key, item)
    }
    return [...merged.values()]
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .slice(0, FEED_LIMIT)
  }, [liveItems, recent.data])

  const s = summary.data
  const pct = (n: number) => (s && s.totalActive > 0 ? `${Math.round((n / s.totalActive) * 100)}% dari karyawan aktif` : undefined)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Monitoring kehadiran"
        description={formatLongDate(today)}
        actions={<LiveClock size="sm" className="items-end text-right" />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Karyawan aktif" value={s?.totalActive ?? 0} icon={Users} tone="primary" loading={summary.isLoading} />
        <StatCard label="Sudah check-in" value={s?.checkedIn ?? 0} icon={UserCheck} tone="success" loading={summary.isLoading} hint={s && pct(s.checkedIn)} />
        <StatCard label="Tepat waktu" value={s?.onTime ?? 0} icon={Clock} tone="success" loading={summary.isLoading} />
        <StatCard label="Terlambat" value={s?.late ?? 0} icon={UserRoundX} tone="warning" loading={summary.isLoading} />
        <StatCard label="Belum check-in" value={s?.notCheckedIn ?? 0} icon={UserX} tone="danger" loading={summary.isLoading} hint={s && pct(s.notCheckedIn)} />
        <StatCard label="Sudah check-out" value={s?.checkedOut ?? 0} icon={LogOut} tone="neutral" loading={summary.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <AttendanceChart stats={stats.data} loading={stats.isLoading} days={STATS_DAYS} />
          <AbsenteesList items={absentees.data} loading={absentees.isLoading} />
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <RealtimeFeed items={feed} loading={recent.isLoading} connected={connected} onSelect={setDetailId} />
        </div>
      </div>

      <PhotoViewer attendanceId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </div>
  )
}
