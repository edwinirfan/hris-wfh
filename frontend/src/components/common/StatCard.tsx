import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

const ICON_TONE: Record<StatTone, string> = {
  primary: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  neutral: 'bg-slate-100 text-slate-600',
}

interface StatCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  tone?: StatTone
  hint?: ReactNode
  loading?: boolean
  className?: string
}

export function StatCard({ label, value, icon: Icon, tone = 'primary', hint, loading, className }: StatCardProps) {
  return (
    <Card className={cn('gap-0 p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-14" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          )}
        </div>
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', ICON_TONE[tone])}>
          <Icon className="size-4.5" aria-hidden />
        </div>
      </div>
      {hint && !loading && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
