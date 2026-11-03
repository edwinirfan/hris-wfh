import { createContext, useContext } from 'react'
import type { AuthUser, Employee, TokenPair } from '@/types/api'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  employee: Employee | null
  isHr: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  /** Simpan token baru (mis. setelah ganti password) lalu muat ulang profil */
  applyTokens: (tokens: TokenPair) => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
