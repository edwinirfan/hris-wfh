import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Eye, KeyRound, MoreHorizontal, Pencil, Plus, Power, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { employeesApi } from '@/api/employees.api'
import { queryKeys } from '@/api/query-keys'
import { DataTable, type DataTableColumn, type SortState } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { ActiveBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmployeeFormDialog } from '@/features/employees/EmployeeFormDialog'
import { useEmployeeActions } from '@/features/employees/useEmployeeActions'
import { useDepartments } from '@/features/employees/useMasterData'
import { useDebounce } from '@/hooks/useDebounce'
import { EMPLOYMENT_TYPE_LABEL, formatDate, initials } from '@/lib/format'
import type { Employee, EmployeeListParams } from '@/types/api'

type SortKey = NonNullable<EmployeeListParams['sortBy']>
type StatusFilter = 'all' | 'active' | 'inactive'

export function EmployeesPage() {
  const navigate = useNavigate()
  const departments = useDepartments()
  const actions = useEmployeeActions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim())
  const [departmentId, setDepartmentId] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [sort, setSort] = useState<SortState<SortKey>>({ sortBy: 'createdAt', sortOrder: 'DESC' })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const params: EmployeeListParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    departmentId: departmentId === 'all' ? undefined : departmentId,
    isActive: status === 'all' ? undefined : status === 'active',
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  }
  const query = useQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: () => employeesApi.list(params),
    placeholderData: keepPreviousData,
  })

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (employee: Employee) => {
    setEditing(employee)
    setFormOpen(true)
  }

  const columns: DataTableColumn<Employee, SortKey>[] = [
    {
      id: 'code',
      header: 'NIK',
      sortKey: 'employeeCode',
      cell: (e) => <span className="font-mono text-xs">{e.employeeCode}</span>,
    },
    {
      id: 'name',
      header: 'Nama',
      sortKey: 'fullName',
      cell: (e) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(e.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{e.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{e.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'department',
      header: 'Departemen / Jabatan',
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate">{e.department.name}</p>
          <p className="truncate text-xs text-muted-foreground">{e.position.name}</p>
        </div>
      ),
    },
    { id: 'type', header: 'Tipe', cell: (e) => EMPLOYMENT_TYPE_LABEL[e.employmentType] },
    {
      id: 'join',
      header: 'Bergabung',
      sortKey: 'joinDate',
      cell: (e) => <span className="whitespace-nowrap">{formatDate(e.joinDate, 'DD MMM YYYY')}</span>,
    },
    { id: 'status', header: 'Status', cell: (e) => <ActiveBadge isActive={e.isActive} /> },
    {
      id: 'actions',
      header: <span className="sr-only">Aksi</span>,
      className: 'w-10 text-right',
      cell: (e) => (
        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${e.fullName}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/hr/employees/${e.id}`)}>
                <Eye /> Lihat detail
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openEdit(e)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.requestResetPassword(e)}>
                <KeyRound /> Reset password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant={e.isActive ? 'destructive' : 'default'} onSelect={() => actions.requestToggleStatus(e)}>
                <Power /> {e.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Karyawan"
        description="Kelola data master karyawan dan akun login."
        actions={
          <Button onClick={openCreate}>
            <Plus /> Tambah karyawan
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={query.data?.items}
        rowKey={(e) => e.id}
        loading={query.isLoading}
        meta={query.data?.meta}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size)
          setPage(1)
        }}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
        onRowClick={(e) => navigate(`/hr/employees/${e.id}`)}
        emptyTitle="Karyawan tidak ditemukan"
        emptyDescription="Coba ubah kata kunci atau filter."
        toolbar={
          <>
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Cari nama, NIK, atau email…"
                className="pl-8"
                aria-label="Cari karyawan"
                maxLength={100}
              />
            </div>
            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value)
                setPage(1)
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
                setStatus(value as StatusFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
        onCreated={(result) =>
          actions.showTempPassword({
            title: 'Karyawan berhasil ditambahkan',
            email: result.account.email,
            temporaryPassword: result.account.temporaryPassword,
          })
        }
      />
      {actions.element}
    </>
  )
}
