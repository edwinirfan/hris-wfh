import { PartyPopper } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { initials } from '@/lib/format'
import type { Absentee } from '@/types/api'

export function AbsenteesList({ items, loading }: { items?: Absentee[]; loading?: boolean }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Belum check-in</CardTitle>
        <CardDescription>{items ? `${items.length} karyawan aktif` : 'Hari ini'}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="grid gap-3 px-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !items?.length ? (
          <EmptyState icon={PartyPopper} title="Semua karyawan sudah check-in" />
        ) : (
          <ScrollArea className="max-h-[22rem]">
            <ul className="grid grid-cols-1 gap-0.5 px-2">
              {items.map((a) => (
                <li key={a.employeeId} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {initials(a.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.employeeCode} · {a.departmentName}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
