import { Fingerprint, KeyRound, LogOut, Menu, UserRound } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { RoleBadge } from '@/components/common/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-context'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { NAV_GROUPS } from './navigation'

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Fingerprint className="size-4.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-white">HRIS WFH</span>
        <span className="block text-[11px] text-sidebar-foreground/70">Absensi & Monitoring</span>
      </span>
    </Link>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const groups = NAV_GROUPS.filter((group) => user && group.roles.includes(user.role))

  return (
    <nav className="grid gap-6" aria-label="Navigasi utama">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p className="px-3 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">{group.label}</p>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function UserMenu() {
  const { user, employee, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  const name = employee?.fullName ?? user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(name)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-40 truncate text-sm font-medium">{name}</span>
            <span className="block text-xs text-muted-foreground">{employee?.position.name ?? user.email}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-1">
          <span className="truncate">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          <RoleBadge role={user.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound /> Profil saya
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/change-password')}>
          <KeyRound /> Ganti password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOut /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-svh flex-col gap-8 bg-sidebar px-3 py-5 lg:flex">
        <Brand />
        <SidebarNav />
        <p className="mt-auto px-3 text-[11px] text-sidebar-foreground/50">Waktu mengikuti jam server (WIB)</p>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-8 border-none bg-sidebar px-3 py-5 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <SheetDescription className="sr-only">Pilih halaman</SheetDescription>
          <Brand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Buka menu">
            <Menu />
          </Button>
          <div className="flex-1" />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
