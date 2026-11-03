import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { FullScreenLoader } from '@/components/common/FullScreenLoader'

const CHANGE_PASSWORD_PATH = '/change-password'

/**
 * Wajib login. Bila akun masih memakai password sementara, semua halaman
 * diarahkan ke halaman ganti password (backend juga menolak dengan 403).
 */
export function ProtectedRoute() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader label="Memuat sesi…" />
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (user.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }
  return <Outlet />
}
