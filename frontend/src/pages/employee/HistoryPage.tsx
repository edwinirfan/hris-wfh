import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { attendanceApi } from '@/api/attendance.api'
import { queryKeys } from '@/api/query-keys'
import { PhotoThumb } from '@/components/attendance/PhotoThumb'
import { PhotoViewer } from '@/components/attendance/PhotoViewer'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { DateRangeFilter, type DateRange } from '@/components/common/DateRangeFilter'
import { PageHeader } from '@/components/common/PageHeader'
import { AttendanceStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/features/auth/auth-context'
import { daysAgoInTz, formatDate, formatDuration, formatTime, todayInTz } from '@/lib/format'
import type { AttendanceRecord } from '@/types/api'

export function HistoryPage() {
  const { employee } = useAuth()
  const [range, setRange] = useState<DateRange>(() => ({ from: daysAgoInTz(29), to: todayInTz() }))
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [detailId, setDetailId] = useState<string | null>(null)

  const params = { page, limit, from: range.from, to: range.to }
  const query = useQuery({
    queryKey: queryKeys.attendance.mine(params),
    queryFn: () => attendanceApi.mine(params),
    placeholderData: keepPreviousData,
  })

  const name = employee?.fullName ?? ''
  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      id: 'date',
      header: 'Tanggal',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <PhotoThumb src={row.checkInPhotoUrl} name={name} />
          <span className="font-medium whitespace-nowrap">{formatDate(row.attendanceDate)}</span>
        </div>
      ),
    },
    { id: 'in', header: 'Masuk', cell: (row) => <span className="tabular-nums">{formatTime(row.checkInAt)}</span> },
    { id: 'out', header: 'Pulang', cell: (row) => <span className="tabular-nums">{formatTime(row.checkOutAt)}</span> },
    {
      id: 'duration',
      header: 'Durasi',
      cell: (row) => <span className="whitespace-nowrap">{formatDuration(row.workMinutes)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <AttendanceStatusBadge status={row.status} lateMinutes={row.lateMinutes} />,
    },
  ]

  return (
    <>
      <PageHeader title="Riwayat absensi" description="Klik baris untuk melihat foto dan detail verifikasi." />
      <DataTable
        columns={columns}
        data={query.data?.items}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        meta={query.data?.meta}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size)
          setPage(1)
        }}
        onRowClick={(row) => setDetailId(row.id)}
        emptyTitle="Tidak ada absensi pada rentang ini"
        toolbar={
          <DateRangeFilter
            value={range}
            onChange={(next) => {
              setRange(next)
              setPage(1)
            }}
          />
        }
      />
      <PhotoViewer attendanceId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </>
  )
}
