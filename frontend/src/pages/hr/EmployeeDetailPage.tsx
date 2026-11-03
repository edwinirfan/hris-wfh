import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, KeyRound, Pencil, Power } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { attendanceApi } from '@/api/attendance.api'
import { employeesApi } from '@/api/employees.api'
import { queryKeys } from '@/api/query-keys'
import { PhotoThumb } from '@/components/attendance/PhotoThumb'
import { PhotoViewer } from '@/components/attendance/PhotoViewer'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { DetailList } from '@/components/common/DetailList'
import { FullScreenLoader } from '@/components/common/FullScreenLoader'
import { ActiveBadge, AttendanceStatusBadge, RoleBadge, StatusBadge } from '@/components/common/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmployeeFormDialog } from '@/features/employees/EmployeeFormDialog'
import { useEmployeeActions } from '@/features/employees/useEmployeeActions'
import { getErrorMessage } from '@/lib/api-client'
import {
  daysAgoInTz,
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
  GENDER_LABEL,
  initials,
  isInFuture,
  todayInTz,
} from '@/lib/format'
import type { AttendanceRecord } from '@/types/api'

export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const actions = useEmployeeActions()
  const [editOpen, setEditOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const query = useQuery({ queryKey: queryKeys.employees.detail(id), queryFn: () => employeesApi.detail(id) })
  const employee = query.data

  const historyParams = {
    page,
    limit: 10,
    from: daysAgoInTz(29),
    to: todayInTz(),
    employeeId: id,
    sortBy: 'attendanceDate' as const,
    sortOrder: 'DESC' as const,
  }
  const history = useQuery({
    queryKey: queryKeys.attendance.list(historyParams),
    queryFn: () => attendanceApi.list(historyParams),
    enabled: !!employee,
    placeholderData: keepPreviousData,
  })

  if (query.isLoading) return <FullScreenLoader label="Memuat data karyawan…" />
  if (query.isError || !employee) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertDescription>{query.isError ? getErrorMessage(query.error) : 'Karyawan tidak ditemukan'}</AlertDescription>
      </Alert>
    )
  }

  const account = employee.account
  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      id: 'date',
      header: 'Tanggal',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <PhotoThumb src={row.checkInPhotoUrl} name={employee.fullName} />
          <span className="whitespace-nowrap">{formatDate(row.attendanceDate)}</span>
        </div>
      ),
    },
    { id: 'in', header: 'Masuk', cell: (row) => formatTime(row.checkInAt) },
    { id: 'out', header: 'Pulang', cell: (row) => formatTime(row.checkOutAt) },
    { id: 'duration', header: 'Durasi', cell: (row) => formatDuration(row.workMinutes) },
    { id: 'status', header: 'Status', cell: (row) => <AttendanceStatusBadge status={row.status} lateMinutes={row.lateMinutes} /> },
  ]

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Kembali ke daftar karyawan">
            <Link to="/hr/employees">
              <ArrowLeft />
            </Link>
          </Button>
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
            {initials(employee.fullName)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{employee.fullName}</h1>
              <ActiveBadge isActive={employee.isActive} />
            </div>
            <p className="text-sm text-muted-foreground">
              {employee.employeeCode} · {employee.position.name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
          <Button variant="outline" onClick={() => actions.requestResetPassword(employee)}>
            <KeyRound /> Reset password
          </Button>
          <Button variant={employee.isActive ? 'destructive' : 'default'} onClick={() => actions.requestToggleStatus(employee)}>
            <Power /> {employee.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data karyawan</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Email', value: employee.email },
                { label: 'No. HP', value: employee.phone },
                { label: 'Departemen', value: employee.department.name },
                { label: 'Jabatan', value: employee.position.name },
                { label: 'Tipe karyawan', value: EMPLOYMENT_TYPE_LABEL[employee.employmentType] },
                { label: 'Tanggal bergabung', value: formatDate(employee.joinDate, 'DD MMMM YYYY') },
                { label: 'Jenis kelamin', value: GENDER_LABEL[employee.gender] },
                { label: 'Tanggal lahir', value: formatDate(employee.birthDate, 'DD MMMM YYYY') },
                { label: 'Dibuat', value: formatDateTime(employee.createdAt) },
                { label: 'Diperbarui', value: `${formatDateTime(employee.updatedAt)} · versi ${employee.version}` },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Akun login</CardTitle>
            <CardDescription>Dikelola oleh auth-service</CardDescription>
          </CardHeader>
          <CardContent>
            {account ? (
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: 'Role', value: <RoleBadge role={account.role} /> },
                  { label: 'Status akun', value: <ActiveBadge isActive={account.isActive} /> },
                  {
                    label: 'Password',
                    value: account.mustChangePassword ? (
                      <StatusBadge tone="warning">Masih sementara</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Sudah diganti</StatusBadge>
                    ),
                  },
                  { label: 'Login terakhir', value: formatDateTime(account.lastLoginAt) },
                  {
                    label: 'Terkunci sampai',
                    value: isInFuture(account.lockedUntil) ? formatDateTime(account.lockedUntil) : 'Tidak terkunci',
                  },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Data akun tidak tersedia (auth-service tidak merespons).</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Absensi 30 hari terakhir</h2>
        <DataTable
          columns={columns}
          data={history.data?.items}
          rowKey={(row) => row.id}
          loading={history.isLoading}
          meta={history.data?.meta}
          onPageChange={setPage}
          onRowClick={(row) => setDetailId(row.id)}
          emptyTitle="Belum ada absensi dalam 30 hari terakhir"
        />
      </div>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={employee} />
      <PhotoViewer attendanceId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
      {actions.element}
    </div>
  )
}
