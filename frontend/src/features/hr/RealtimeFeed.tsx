import { Activity, LogIn, LogOut } from 'lucide-react'
import { PhotoThumb } from '@/components/attendance/PhotoThumb'
import { EmptyState } from '@/components/common/EmptyState'
import { AttendanceStatusBadge } from '@/components/common/StatusBadge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTime, fromNow } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AttendanceStatus, AttendanceType } from '@/types/api'

export interface FeedItem {
  key: string
  attendanceId: string
  fullName: string
  employeeCode: string
  departmentName: string
  type: AttendanceType
  status: AttendanceStatus
  lateMinutes: number
  recordedAt: string
  photoUrl: string | null
  live?: boolean
}

interface RealtimeFeedProps {
  items: FeedItem[]
  loading?: boolean
  connected: boolean
  onSelect: (attendanceId: string) => void
}

export function RealtimeFeed({ items, loading, connected, onSelect }: RealtimeFeedProps) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Aktivitas hari ini</CardTitle>
        <CardDescription>Check-in & check-out terbaru</CardDescription>
        <CardAction>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
              connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
            )}
            title={connected ? 'Terhubung ke server realtime' : 'Mencoba menghubungkan…'}
          >
            <span className="relative flex size-2">
              {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={cn('relative inline-flex size-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-slate-400')} />
            </span>
            {connected ? 'Live' : 'Offline'}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="grid gap-3 px-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Activity} title="Belum ada aktivitas" description="Check-in karyawan akan muncul di sini secara langsung." />
        ) : (
          <div className="h-[22rem] overflow-y-auto">
            <ul className="grid grid-cols-1 gap-0.5 px-2">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.attendanceId)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60',
                      item.live && 'animate-in fade-in slide-in-from-top-2 bg-blue-50/60',
                    )}
                  >
                    <PhotoThumb src={item.photoUrl} name={item.fullName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.fullName}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {item.type === 'CHECK_IN' ? (
                          <LogIn className="size-3 shrink-0 text-emerald-600" />
                        ) : (
                          <LogOut className="size-3 shrink-0 text-blue-600" />
                        )}
                        <span className="truncate">
                          {item.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'} · {item.departmentName}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums" title={fromNow(item.recordedAt)}>
                        {formatTime(item.recordedAt)}
                      </span>
                      {item.type === 'CHECK_IN' && <AttendanceStatusBadge status={item.status} lateMinutes={item.lateMinutes} />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
