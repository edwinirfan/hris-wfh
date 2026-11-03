import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import type { AttendanceStats } from '@/types/api'

const SERIES = [
  { key: 'onTime', label: 'Tepat waktu', color: 'var(--color-chart-1)' },
  { key: 'late', label: 'Terlambat', color: 'var(--color-chart-2)' },
  { key: 'absent', label: 'Tidak absen', color: 'var(--color-chart-3)' },
] as const

interface AttendanceChartProps {
  stats?: AttendanceStats
  loading?: boolean
  days: number
}

/** Stacked bar kehadiran per hari */
export function AttendanceChart({ stats, loading, days }: AttendanceChartProps) {
  const data = stats?.days.map((d) => ({ ...d, label: formatDate(d.date, 'ddd DD/MM') })) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tren kehadiran</CardTitle>
        <CardDescription>{days} hari terakhir</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : data.length === 0 ? (
          <EmptyState icon={BarChart3} title="Belum ada data" />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                <Tooltip
                  cursor={{ fill: 'var(--color-muted)', opacity: 0.6 }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)',
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                {SERIES.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="attendance"
                    fill={s.color}
                    radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={44}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
