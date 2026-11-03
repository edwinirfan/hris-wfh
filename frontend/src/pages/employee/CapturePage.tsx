import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { attendanceApi } from '@/api/attendance.api'
import { queryKeys } from '@/api/query-keys'
import { CameraCapture, type CaptureResult } from '@/components/attendance/CameraCapture'
import { LiveClock } from '@/components/attendance/LiveClock'
import { FullScreenLoader } from '@/components/common/FullScreenLoader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTodayAttendance } from '@/features/attendance/useTodayAttendance'
import { ApiError, getErrorMessage } from '@/lib/api-client'
import { formatTime } from '@/lib/format'
import type { AttendanceType } from '@/types/api'

const TITLES: Record<AttendanceType, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
}

export function CapturePage() {
  const [params] = useSearchParams()
  const type = params.get('type') === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const today = useTodayAttendance()
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: (capture: CaptureResult) =>
      attendanceApi.submit({
        type,
        photo: capture.blob,
        ...capture.metadata,
        location: capture.location,
        note,
      }),
    onSuccess: (record) => {
      const time = formatTime(type === 'CHECK_IN' ? record.checkInAt : record.checkOutAt)
      toast.success(`${TITLES[type]} berhasil pukul ${time} WIB`, {
        description: type === 'CHECK_IN' && record.status === 'LATE' ? `Tercatat terlambat ${record.lateMinutes} menit` : undefined,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all })
      navigate('/dashboard', { replace: true })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
      // status hari ini berubah (mis. sudah check-in dari perangkat lain) → muat ulang
      if (error instanceof ApiError && error.status === 409 && !error.message.toLowerCase().includes('foto')) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.today })
      }
    },
  })

  const allowed = today.data ? (type === 'CHECK_IN' ? today.data.canCheckIn : today.data.canCheckOut) : true
  const blocked = !!today.data && !allowed && !mutation.isPending && !mutation.isSuccess

  useEffect(() => {
    if (!blocked) return
    toast.info(type === 'CHECK_IN' ? 'Anda sudah check-in hari ini' : 'Check-out belum tersedia')
    navigate('/dashboard', { replace: true })
  }, [blocked, navigate, type])

  if (today.isLoading || blocked) return <FullScreenLoader label="Memeriksa status absensi…" />

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Kembali">
          <Link to="/dashboard">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{TITLES[type]}</h1>
          <p className="text-sm text-muted-foreground">Ambil swafoto sebagai bukti bekerja dari rumah</p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <LiveClock size="sm" />
            <p className="max-w-xs text-xs text-muted-foreground">
              Waktu absen dicatat dari jam server saat foto dikirim, bukan dari jam perangkat Anda.
            </p>
          </div>

          <CameraCapture
            onSubmit={(capture) => mutation.mutate(capture)}
            submitting={mutation.isPending}
            submitLabel={`Kirim ${TITLES[type].toLowerCase()}`}
            extra={
              <div className="grid gap-1.5">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  maxLength={255}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Mis. mulai kerja dari rumah, koneksi stabil"
                  rows={2}
                />
                <span className="justify-self-end text-xs text-muted-foreground">{note.length}/255</span>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Alert>
        <Info />
        <AlertTitle>Privasi</AlertTitle>
        <AlertDescription>
          Deteksi wajah berjalan di perangkat Anda. Hanya foto akhir, skor verifikasi, dan lokasi (bila diizinkan) yang dikirim ke
          server dan hanya dapat dilihat oleh HR.
        </AlertDescription>
      </Alert>
    </div>
  )
}
