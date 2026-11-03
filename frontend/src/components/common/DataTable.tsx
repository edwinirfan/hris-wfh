import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PaginationMeta, SortOrder } from '@/types/api'

export interface DataTableColumn<T, TSortKey extends string = string> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Kunci sort yang dikirim ke server; kolom tanpa sortKey tidak bisa di-sort */
  sortKey?: TSortKey
  className?: string
  headerClassName?: string
}

export interface SortState<TSortKey extends string = string> {
  sortBy: TSortKey
  sortOrder: SortOrder
}

interface DataTableProps<T, TSortKey extends string> {
  columns: DataTableColumn<T, TSortKey>[]
  data: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  meta?: PaginationMeta
  onPageChange?: (page: number) => void
  onPageSizeChange?: (limit: number) => void
  pageSizeOptions?: number[]
  sort?: SortState<TSortKey>
  onSortChange?: (sort: SortState<TSortKey>) => void
  onRowClick?: (row: T) => void
  emptyTitle?: string
  emptyDescription?: ReactNode
  toolbar?: ReactNode
  className?: string
}

/**
 * Tabel generik dengan paginasi & sorting di sisi server.
 * Loading → skeleton seukuran halaman; data kosong → empty state.
 */
export function DataTable<T, TSortKey extends string = string>({
  columns,
  data,
  rowKey,
  loading,
  meta,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  sort,
  onSortChange,
  onRowClick,
  emptyTitle = 'Belum ada data',
  emptyDescription,
  toolbar,
  className,
}: DataTableProps<T, TSortKey>) {
  const skeletonRows = Math.min(meta?.limit ?? 5, 10)
  const rows = data ?? []

  const toggleSort = (key: TSortKey) => {
    if (!onSortChange) return
    if (sort?.sortBy === key) {
      onSortChange({ sortBy: key, sortOrder: sort.sortOrder === 'ASC' ? 'DESC' : 'ASC' })
    } else {
      onSortChange({ sortBy: key, sortOrder: 'ASC' })
    }
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick?.(row)
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      {toolbar && <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center">{toolbar}</div>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((column) => {
                const sortKey = column.sortKey
                const active = sortKey !== undefined && sort?.sortBy === sortKey
                return (
                  <TableHead
                    key={column.id}
                    className={cn('h-10 text-xs font-semibold uppercase tracking-wide', column.headerClassName)}
                    aria-sort={active ? (sort?.sortOrder === 'ASC' ? 'ascending' : 'descending') : undefined}
                  >
                    {sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(sortKey)}
                        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                      >
                        {column.header}
                        {active ? (
                          sort?.sortOrder === 'ASC' ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }, (_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(onRowClick && 'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none')}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn('py-2.5', column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && <PaginationBar meta={meta} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} pageSizeOptions={pageSizeOptions} />}
    </div>
  )
}

interface PaginationBarProps {
  meta: PaginationMeta
  onPageChange?: (page: number) => void
  onPageSizeChange?: (limit: number) => void
  pageSizeOptions: number[]
}

function PaginationBar({ meta, onPageChange, onPageSizeChange, pageSizeOptions }: PaginationBarProps) {
  const { page, limit, total, totalPages } = meta
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="flex flex-col gap-3 border-t px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground tabular-nums">{from}–{to}</span> dari{' '}
        <span className="font-medium text-foreground tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select value={String(limit)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger size="sm" aria-label="Jumlah baris per halaman">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / hlm
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-16 text-center tabular-nums">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
