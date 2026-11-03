import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DetailItem {
  label: string
  value: ReactNode
}

/** Daftar label–nilai dua kolom untuk halaman profil/detail */
export function DetailList({ items, className }: { items: DetailItem[]; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
