import { CloudOff, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useServerTime } from '@/hooks/useServerTime'
import { dayjs, TZ } from '@/lib/format'
import { cn } from '@/lib/utils'

interface LiveClockProps {
  size?: 'sm' | 'lg'
  className?: string
}

/** Jam berjalan yang mengikuti jam server (WIB), bukan jam perangkat */
export function LiveClock({ size = 'lg', className }: LiveClockProps) {
  const { now, synced } = useServerTime()
  const [tick, setTick] = useState(() => now())

  useEffect(() => {
    // selaraskan pergantian detik dengan detik jam server
    let interval: number | undefined
    const timeout = window.setTimeout(() => {
      setTick(now())
      interval = window.setInterval(() => setTick(now()), 1000)
    }, 1000 - (now() % 1000))
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [now])

  const time = dayjs(tick).tz(TZ)

  return (
    <div className={cn('flex flex-col', className)} aria-live="off">
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-semibold tracking-tight tabular-nums',
            size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-xl',
          )}
        >
          {time.format('HH:mm')}
          <span className={cn('text-muted-foreground', size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-base')}>
            :{time.format('ss')}
          </span>
        </span>
        <span className="text-sm font-medium text-muted-foreground">WIB</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{time.format('dddd, DD MMMM YYYY')}</span>
        <span
          title={synced ? 'Tersinkron dengan jam server' : 'Belum tersinkron — memakai jam perangkat'}
          className={cn('inline-flex', synced ? 'text-emerald-600' : 'text-amber-600')}
        >
          {synced ? <RefreshCcw className="size-3.5" /> : <CloudOff className="size-3.5" />}
        </span>
      </div>
    </div>
  )
}
