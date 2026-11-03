import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CalendarClock, History, LogIn, LogOut, RefreshCw, Timer } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { attendanceApi } from '@/api/attendance.api'
import { queryKeys } from '@/api/query-keys'
import { LiveClock } from '@/components/attendance/LiveClock'
import { PhotoThumb } from '@/components/attendance/PhotoThumb'
import { PhotoViewer } from '@/components/attendance/PhotoViewer'
import { EmptyState } from '@/components/common/EmptyState'
import { AttendanceStatusBadge } from '@/components/common/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useTodayAttendance } from '@/features/attendance/useTodayAttendance'
import { useRealtime } from '@/hooks/useRealtime'
import { useServerTime } from '@/hooks/useServerTime'
import { getErrorMessage } from '@/lib/api-client'
import { formatDate, formatDuration, formatTime, greeting } from '@/lib/format'

export function DashboardPage() {
  const { employee, user } = useAuth()
  const { offsetMs } = useServerTime()
  const queryClient = useQueryClient()
  const today = useTodayAttendance()
  const [detailId, setDetailId] = useState<string | null>(null)

  const recent = useQuery({
    queryKey: queryKeys.attendance.mine({ page: 1, limit: 5 }),
    queryFn: () => attendanceApi.mine({ page: 1, limit: 5 }),
  })

  // absen dari perangkat lain → status di sini ikut diperbarui
  const onRecorded = useCallback(
    (event: { employeeId: string }) => {
      if (event.employeeId === user?.employeeId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all })
      }
    },
    [queryClient, user?.employeeId],
  )
  useRealtime({ onAttendanceRecorded: onRecorded })

  const firstName = employee?.fullName.split(' ')[0] ?? ''
  const data = today.data
  const attendance = data?.attendance

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {greeting(offsetMs)}
          {firstName && `, ${firstName}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {employee ? `${employee.position.name} · ${employee.department.name}` : 'Selamat bekerja dari rumah'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Absensi hari ini</CardTitle>
            <CardDescription>
              {data
                ? `Jam kerja ${data.schedule.workStart}–${data.schedule.workEnd} · toleransi ${data.schedule.lateToleranceMinutes} menit`
                : 'Memuat jadwal…'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <LiveClock />

            {today.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}

            {today.isError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  {getErrorMessage(today.error)}
                  <Button size="xs" variant="outline" onClick={() => void today.refetch()}>
                    <RefreshCw /> Coba lagi
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {data && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <TimeTile
                    icon={LogIn}
                    label="Check-in"
                    value={formatTime(attendance?.checkInAt)}
                    photoUrl={attendance?.checkInPhotoUrl}
                    name={employee?.fullName ?? ''}
                    footer={attendance && <AttendanceStatusBadge status={attendance.status} lateMinutes={attendance.lateMinutes} />}
                  />
                  <TimeTile
                    icon={LogOut}
                    label="Check-out"
                    value={formatTime(attendance?.checkOutAt)}
                    photoUrl={attendance?.checkOutPhotoUrl}
                    name={employee?.fullName ?? ''}
                    footer={
                      attendance?.workMinutes !== null && attendance?.workMinutes !== undefined ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Timer className="size-3.5" /> {formatDuration(attendance.workMinutes)}
                        </span>
                      ) : null
                    }
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {data.canCheckIn && (
                    <Button asChild size="lg" className="h-11 sm:flex-1">
                      <Link to="/attendance/capture?type=CHECK_IN">
                        <LogIn /> Check-in sekarang
                      </Link>
                    </Button>
                  )}
                  {data.canCheckOut && (
                    <Button asChild size="lg" variant={data.canCheckIn ? 'outline' : 'default'} className="h-11 sm:flex-1">
                      <Link to="/attendance/capture?type=CHECK_OUT">
                        <LogOut /> Check-out sekarang
                      </Link>
                    </Button>
                  )}
                  {!data.canCheckIn && !data.canCheckOut && (
                    <p className="w-full rounded-lg bg-emerald-50 px-3 py-2.5 text-center text-sm text-emerald-700">
                      Absensi hari ini sudah lengkap. Terima kasih!
                    </p>
                  )}
                </div>
                {attendance && (
                  <Button variant="link" className="justify-self-start px-0" onClick={() => setDetailId(attendance.id)}>
                    Lihat detail & foto <ArrowRight />
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Riwayat terakhir</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link to="/attendance/history">
                  Semua <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recent.isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recent.data?.items.length ? (
              <ul className="divide-y">
                {recent.data.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setDetailId(item.id)}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/40"
                    >
                      <span>
                        <span className="block text-sm font-medium">{formatDate(item.attendanceDate)}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {formatTime(item.checkInAt)} – {formatTime(item.checkOutAt)}
                        </span>
                      </span>
                      <AttendanceStatusBadge status={item.status} lateMinutes={item.lateMinutes} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={History} title="Belum ada riwayat absensi" />
            )}
          </CardContent>
        </Card>
      </div>

      <PhotoViewer attendanceId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </div>
  )
}

interface TimeTileProps {
  icon: typeof CalendarClock
  label: string
  value: string
  photoUrl?: string | null
  name: string
  footer?: React.ReactNode
}

function TimeTile({ icon: Icon, label, value, photoUrl, name, footer }: TimeTileProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3">
      {photoUrl ? (
        <PhotoThumb src={photoUrl} name={name} className="size-11 rounded-lg" />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="size-5" />
        </span>
      )}
      <div className="grid min-w-0 gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {footer}
      </div>
    </div>
  )
}
