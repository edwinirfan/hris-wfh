import { QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/routing/ProtectedRoute'
import { HomeRedirect, RoleRoute } from '@/components/routing/RoleRoute'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { lazyPage } from '@/lib/lazy-page'
import { queryClient } from '@/lib/query-client'
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Halaman dimuat per rute: MediaPipe hanya di halaman capture, Recharts hanya di dashboard HR
const DashboardPage = lazyPage(() => import('@/pages/employee/DashboardPage'), 'DashboardPage')
const CapturePage = lazyPage(() => import('@/pages/employee/CapturePage'), 'CapturePage')
const HistoryPage = lazyPage(() => import('@/pages/employee/HistoryPage'), 'HistoryPage')
const ProfilePage = lazyPage(() => import('@/pages/employee/ProfilePage'), 'ProfilePage')
const MonitoringDashboardPage = lazyPage(() => import('@/pages/hr/MonitoringDashboardPage'), 'MonitoringDashboardPage')
const EmployeesPage = lazyPage(() => import('@/pages/hr/EmployeesPage'), 'EmployeesPage')
const EmployeeDetailPage = lazyPage(() => import('@/pages/hr/EmployeeDetailPage'), 'EmployeeDetailPage')
const AttendanceMonitoringPage = lazyPage(() => import('@/pages/hr/AttendanceMonitoringPage'), 'AttendanceMonitoringPage')

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/change-password', element: <ChangePasswordPage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          // semua role (HR juga karyawan)
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/attendance/capture', element: <CapturePage /> },
          { path: '/attendance/history', element: <HistoryPage /> },
          { path: '/profile', element: <ProfilePage /> },
          {
            element: <RoleRoute roles={['ADMIN_HR']} />,
            children: [
              { path: '/hr/dashboard', element: <MonitoringDashboardPage /> },
              { path: '/hr/employees', element: <EmployeesPage /> },
              { path: '/hr/employees/:id', element: <EmployeeDetailPage /> },
              { path: '/hr/attendance', element: <AttendanceMonitoringPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
