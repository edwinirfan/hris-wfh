import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, History, LayoutDashboard, MonitorCheck, UserRound, Users } from 'lucide-react'
import type { Role } from '@/types/api'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  roles: Role[]
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'HR',
    roles: ['ADMIN_HR'],
    items: [
      { to: '/hr/dashboard', label: 'Monitoring', icon: MonitorCheck },
      { to: '/hr/employees', label: 'Karyawan', icon: Users },
      { to: '/hr/attendance', label: 'Absensi Karyawan', icon: CalendarCheck },
    ],
  },
  {
    label: 'Absensi Saya',
    roles: ['ADMIN_HR', 'EMPLOYEE'],
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/attendance/history', label: 'Riwayat Absensi', icon: History },
      { to: '/profile', label: 'Profil', icon: UserRound },
    ],
  },
]
