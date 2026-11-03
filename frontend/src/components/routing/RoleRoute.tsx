import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import type { Role } from '@/types/api'

/** Membatasi akses berdasarkan role; role lain diarahkan ke beranda masing-masing */
export function RoleRoute({ roles }: { roles: Role[] }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

/** Beranda sesuai role */
export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'ADMIN_HR' ? '/hr/dashboard' : '/dashboard'} replace />
}
