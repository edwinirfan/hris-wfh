import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, ExternalLink, Globe, ImageOff, LogIn, LogOut, MapPin, Monitor, StickyNote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { attendanceApi } from '@/api/attendance.api'
import { queryKeys } from '@/api/query-keys'
import { EmptyState } from '@/components/common/EmptyState'
import { AttendanceStatusBadge, VerificationBadge } from '@/components/common/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api-client'
import { formatBytes, formatDuration, formatLongDate, formatTimeSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AttendanceLog } from '@/types/api'

const CLOCK_DRIFT_WARNING_SECONDS = 300

interface PhotoViewerProps {
  attendanceId: string | null
  onOpenChange: (open: boolean) => void
}

/** Detail satu record absensi: foto check-in/out beserta jejak verifikasinya */
export function PhotoViewer({ attendanceId, onOpenChange }: PhotoViewerProps) {
  const query = useQuery({
    queryKey: queryKeys.attendance.detail(attendanceId ?? ''),
    queryFn: () => attendanceApi.detail(attendanceId!),
    enabled: !!attendanceId,
    // URL foto bertanda tangan berlaku 5 menit
    staleTime: 60_000,
  })
  const record = query.data

  return (
    <Dialog open={!!attendanceId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{record ? record.employee.fullName : 'Detail absensi'}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              {record ? (
                <>
                  <span>
                    {record.employee.employeeCode} · {record.employee.departmentName} · {formatLongDate(record.attendanceDate)}
                  </span>
                  <AttendanceStatusBadge status={record.status} lateMinutes={record.lateMinutes} />
                  {record.workMinutes !== null && (
                    <span className="text-xs">Durasi kerja {formatDuration(record.workMinutes)}</span>
                  )}
                </>
              ) : (
                <span>Memuat…</span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {query.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          </div>
        )}

        {query.isError && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{getErrorMessage(query.error)}</AlertDescription>
          </Alert>
        )}

        {record && record.logs.length === 0 && (
          <EmptyState
            icon={ImageOff}
            title="Tidak ada log foto"
            description="Record ini tidak memiliki foto (mis. data contoh hasil seeding)."
          />
        )}

        {record && record.logs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(['CHECK_IN', 'CHECK_OUT'] as const).map((type) => {
              const log = record.logs.find((l) => l.type === type)
              return log ? (
                <LogCard key={type} log={log} />
              ) : (
                <div key={type} className="flex min-h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  {type === 'CHECK_OUT' ? 'Belum check-out' : 'Tidak ada check-in'}
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LogCard({ log }: { log: AttendanceLog }) {
  const [zoomed, setZoomed] = useState(false)
  const [broken, setBroken] = useState(false)
  const drift = log.clockDriftSeconds
  const driftWarning = drift !== null && Math.abs(drift) > CLOCK_DRIFT_WARNING_SECONDS
  const isIn = log.type === 'CHECK_IN'

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          {isIn ? <LogIn className="size-4 text-emerald-600" /> : <LogOut className="size-4 text-blue-600" />}
          {isIn ? 'Check-in' : 'Check-out'}
        </span>
        <span className="text-sm font-semibold tabular-nums">{formatTimeSeconds(log.recordedAt)}</span>
      </div>

      <button
        type="button"
        onClick={() => setZoomed((z) => !z)}
        className={cn('relative block w-full bg-slate-900', zoomed ? 'aspect-auto' : 'aspect-[4/3]')}
        aria-label={zoomed ? 'Perkecil foto' : 'Perbesar foto'}
      >
        {broken ? (
          <div className="flex size-full min-h-40 flex-col items-center justify-center gap-1 text-xs text-white/70">
            <ImageOff className="size-5" />
            Foto kedaluwarsa — tutup lalu buka kembali
          </div>
        ) : (
          <img
            src={log.photoUrl}
            alt={`Foto ${isIn ? 'check-in' : 'check-out'}`}
            className={cn('w-full', zoomed ? 'h-auto' : 'size-full object-cover')}
            onError={() => setBroken(true)}
            loading="lazy"
          />
        )}
      </button>

      <div className="grid gap-2 p-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <VerificationBadge livenessPassed={log.livenessPassed} faceConfidence={log.faceConfidence} />
        </div>

        {driftWarning && (
          <Alert className="border-amber-200 bg-amber-50 py-2 text-amber-900">
            <AlertTriangle />
            <AlertDescription className="text-amber-900">
              Jam perangkat berselisih {Math.round(Math.abs(drift) / 60)} menit dari jam server.
            </AlertDescription>
          </Alert>
        )}

        <Meta icon={Clock} label="Jam perangkat">
          {log.clientTime ? formatTimeSeconds(log.clientTime) : '—'}
          {drift !== null && <span className="text-muted-foreground"> (selisih {drift > 0 ? '+' : ''}{drift} dtk)</span>}
        </Meta>
        <Meta icon={MapPin} label="Lokasi">
          {log.latitude !== null && log.longitude !== null ? (
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={`https://www.openstreetmap.org/?mlat=${log.latitude}&mlon=${log.longitude}#map=17/${log.latitude}/${log.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
              {log.locationAccuracyM !== null && ` (±${Math.round(log.locationAccuracyM)} m)`}
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="text-muted-foreground">Tidak dibagikan</span>
          )}
        </Meta>
        <Meta icon={Globe} label="IP">
          {log.ipAddress ?? '—'}
        </Meta>
        <Meta icon={Monitor} label="Perangkat">
          <span className="line-clamp-2 break-all" title={log.userAgent ?? undefined}>
            {log.userAgent ?? '—'}
          </span>
        </Meta>
        {log.note && (
          <Meta icon={StickyNote} label="Catatan">
            {log.note}
          </Meta>
        )}
        <p className="text-xs text-muted-foreground">
          Foto {log.photoWidth}×{log.photoHeight} · {formatBytes(log.photoSize)} · {log.faceCount} wajah
        </p>
      </div>
    </div>
  )
}

function Meta({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1rem_5.5rem_1fr] items-start gap-2">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
