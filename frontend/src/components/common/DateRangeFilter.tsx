import { CalendarRange } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { dayjs, DATE_FORMAT, formatDate, TZ } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface DateRange {
  from: string
  to: string
}

interface Preset {
  label: string
  range: () => DateRange
}

const today = () => dayjs().tz(TZ)

const PRESETS: Preset[] = [
  { label: 'Hari ini', range: () => ({ from: today().format(DATE_FORMAT), to: today().format(DATE_FORMAT) }) },
  {
    label: '7 hari terakhir',
    range: () => ({ from: today().subtract(6, 'day').format(DATE_FORMAT), to: today().format(DATE_FORMAT) }),
  },
  {
    label: '30 hari terakhir',
    range: () => ({ from: today().subtract(29, 'day').format(DATE_FORMAT), to: today().format(DATE_FORMAT) }),
  },
  {
    label: 'Bulan ini',
    range: () => ({ from: today().startOf('month').format(DATE_FORMAT), to: today().format(DATE_FORMAT) }),
  },
]

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
  /** Batas maksimal rentang (hari) */
  maxDays?: number
  className?: string
}

function describe(range: DateRange) {
  if (range.from === range.to) return formatDate(range.from, 'DD MMM YYYY')
  return `${formatDate(range.from, 'DD MMM')} – ${formatDate(range.to, 'DD MMM YYYY')}`
}

/** Pemilih rentang tanggal dengan preset cepat + input tanggal native (ramah ponsel) */
export function DateRangeFilter({ value, onChange, maxDays = 366, className }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>(value)

  const span = dayjs(draft.to).diff(dayjs(draft.from), 'day')
  const error = !draft.from || !draft.to
    ? 'Tanggal wajib diisi'
    : span < 0
      ? 'Tanggal akhir harus setelah tanggal awal'
      : span >= maxDays
        ? `Rentang maksimal ${maxDays} hari`
        : null

  const apply = (range: DateRange) => {
    onChange(range)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value)
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('justify-start font-normal', className)}>
          <CalendarRange className="text-muted-foreground" />
          {describe(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,22rem)]">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <Button key={preset.label} size="xs" variant="secondary" onClick={() => apply(preset.range())}>
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="range-from" className="text-xs">
                Dari
              </Label>
              <Input
                id="range-from"
                type="date"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="range-to" className="text-xs">
                Sampai
              </Label>
              <Input
                id="range-to"
                type="date"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" disabled={!!error} onClick={() => apply(draft)}>
            Terapkan
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
