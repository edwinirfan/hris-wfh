import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Eye, Search } from 'lucide-react'
import { useState } from 'react'
import { attendanceApi } from '@/api/attendance.api'
import { queryKeys } from '@/api/query-keys'
import { PhotoThumb } from '@/components/attendance/PhotoThumb'
import { PhotoViewer } from '@/components/attendance/PhotoViewer'
import { DataTable, type DataTableColumn, type SortState } from '@/components/common/DataTable'
import { DateRangeFilter, type DateRange } from '@/components/common/DateRangeFilter'
import { PageHeader } from '@/components/common/PageHeader'
import { AttendanceStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDepartments } from '@/features/employees/useMasterData'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, formatDuration, formatTime, todayInTz } from '@/lib/format'
import type { AttendanceListParams, AttendanceRecord, AttendanceStatus } from '@/types/api'

type SortKey = NonNullable<AttendanceListParams['sortBy']>

export function AttendanceMonitoringPage() {
  const departments = useDepartments()
  const [range, setRange] = useState<DateRange>(() => ({ from: todayInTz(), to: todayInTz() }))
  const [departmentId, setDepartmentId] = useState('all')
  const [status, setStatus] = useState<'all' | AttendanceStatus>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim())
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [sort, setSort] = useState<SortState<SortKey>>({ sortBy: 'checkInAt', sortOrder: 'DESC' })
  const [detailId, setDetailId] = useState<string | null>(null)

  const params: AttendanceListParams = {
    page,
    limit,
    from: range.from,
    to: range.to,
    departmentId: departmentId === 'all' ? undefined : departmentId,
    status: status === 'all' ? undefined : status,
    search: debouncedSearch || undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  }
  const query = useQuery({
    queryKey: queryKeys.attendance.list(params),
    queryFn: () => attendanceApi.list(params),
    placeholderData: keepPreviousData,
  })

  const resetPage = () => setPage(1)

  const columns: DataTableColumn<AttendanceRecord, SortKey>[] = [
    {
      id: 'employee',
      header: 'Karyawan',
      sortKey: 'fullName',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <PhotoThumb src={row.checkInPhotoUrl} name={row.employee.fullName} />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.employee.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.employee.employeeCode}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'department',
      header: 'Departemen',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.employee.departmentName}</p>
          <p className="truncate text-xs text-muted-foreground">{row.employee.positionName}</p>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Tanggal',
      sortKey: 'attendanceDate',
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.attendanceDate)}</span>,
    },
    {
      id: 'in',
      header: 'Masuk',
      sortKey: 'checkInAt',
      cell: (row) => <span className="tabular-nums">{formatTime(row.checkInAt)}</span>,
    },
    { id: 'out', header: 'Pulang', cell: (row) => <span className="tabular-nums">{formatTime(row.checkOutAt)}</span> },
    { id: 'duration', header: 'Durasi', cell: (row) => <span className="whitespace-nowrap">{formatDuration(row.workMinutes)}</span> },
    { id: 'status', header: 'Status', cell: (row) => <AttendanceStatusBadge status={row.status} lateMinutes={row.lateMinutes} /> },
  ]

  return (
    <>
      <PageHeader
        title="Absensi karyawan"
        description="Pantau absensi yang telah disubmit. Klik baris untuk melihat foto & jejak verifikasi."
        badge={
          <StatusBadge tone="info" icon={Eye}>
            Hanya lihat
          </StatusBadge>
        }
      />
      <DataTable
        columns={columns}
        data={query.data?.items}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        meta={query.data?.meta}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size)
          resetPage()
        }}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          resetPage()
        }}
        onRowClick={(row) => setDetailId(row.id)}
        emptyTitle="Tidak ada absensi"
        emptyDescription="Belum ada absensi yang cocok dengan filter."
        toolbar={
          <>
            <DateRangeFilter
              value={range}
              onChange={(next) => {
                setRange(next)
                resetPage()
              }}
            />
            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value)
                resetPage()
              }}
            >
              <SelectTrigger className="w-full sm:w-52" aria-label="Filter departemen">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua departemen</SelectItem>
                {departments.data?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as 'all' | AttendanceStatus)
                resetPage()
              }}
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="PRESENT">Tepat waktu</SelectItem>
                <SelectItem value="LATE">Terlambat</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative sm:ml-auto sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetPage()
                }}
                placeholder="Cari nama atau NIK…"
                className="pl-8"
                aria-label="Cari karyawan"
                maxLength={100}
              />
            </div>
          </>
        }
      />
      <PhotoViewer attendanceId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </>
  )
}
