import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Clock, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatPercent, ROLE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AttendanceStatus, Role } from '@/types/api'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE_CLASS: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

interface StatusBadgeProps {
  tone: BadgeTone
  icon?: LucideIcon
  children: ReactNode
  className?: string
  title?: string
}

/** Badge status dengan nada warna semantik — dipakai oleh badge spesifik di bawah */
export function StatusBadge({ tone, icon: Icon, children, className, title }: StatusBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  )
}

export function AttendanceStatusBadge({ status, lateMinutes }: { status: AttendanceStatus; lateMinutes?: number }) {
  if (status === 'LATE') {
    return (
      <StatusBadge tone="warning" icon={Clock}>
        Terlambat{lateMinutes ? ` ${lateMinutes} mnt` : ''}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone="success" icon={CheckCircle2}>
      Tepat waktu
    </StatusBadge>
  )
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <StatusBadge tone="success">Aktif</StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={XCircle}>
      Nonaktif
    </StatusBadge>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  return <StatusBadge tone={role === 'ADMIN_HR' ? 'info' : 'neutral'}>{ROLE_LABEL[role]}</StatusBadge>
}

export function VerificationBadge({ livenessPassed, faceConfidence }: { livenessPassed: boolean; faceConfidence: number }) {
  const verified = livenessPassed && faceConfidence >= 0.7
  return verified ? (
    <StatusBadge tone="success" icon={ShieldCheck} title="Liveness lolos dan keyakinan wajah ≥ 70%">
      Terverifikasi · {formatPercent(faceConfidence)}
    </StatusBadge>
  ) : (
    <StatusBadge tone="warning" icon={ShieldAlert} title="Perlu ditinjau manual">
      Perlu ditinjau · {formatPercent(faceConfidence)}
    </StatusBadge>
  )
}
