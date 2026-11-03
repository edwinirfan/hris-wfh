import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth.api'
import { AUTH_EVENTS } from '@/lib/api-client'
import { tokenStorage } from '@/lib/token-storage'
import type { AuthUser, Employee, MeResponse, TokenPair } from '@/types/api'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(() => tokenStorage.getUser())
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.getAccessToken() ? 'loading' : 'unauthenticated',
  )

  const clearSession = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
    setEmployee(null)
    setStatus('unauthenticated')
    queryClient.clear()
  }, [queryClient])

  const applyMe = useCallback((me: MeResponse) => {
    tokenStorage.saveUser(me.user)
    setUser(me.user)
    setEmployee(me.employee)
    setStatus('authenticated')
  }, [])

  const refreshProfile = useCallback(async () => {
    applyMe(await authApi.me())
  }, [applyMe])

  // Validasi sesi yang tersimpan saat aplikasi dibuka
  useEffect(() => {
    if (!tokenStorage.getAccessToken()) return
    let cancelled = false
    authApi
      .me()
      .then((me) => !cancelled && applyMe(me))
      .catch(() => !cancelled && clearSession())
    return () => {
      cancelled = true
    }
  }, [applyMe, clearSession])

  // Sinkron dengan event dari HTTP client
  useEffect(() => {
    const onLogout = () => clearSession()
    const onRefreshed = (event: Event) => {
      const refreshed = (event as CustomEvent<AuthUser>).detail
      if (refreshed) setUser(refreshed)
    }
    const onPasswordChangeRequired = () =>
      setUser((current) => (current ? { ...current, mustChangePassword: true } : current))

    window.addEventListener(AUTH_EVENTS.LOGOUT, onLogout)
    window.addEventListener(AUTH_EVENTS.TOKENS_REFRESHED, onRefreshed)
    window.addEventListener(AUTH_EVENTS.PASSWORD_CHANGE_REQUIRED, onPasswordChangeRequired)
    return () => {
      window.removeEventListener(AUTH_EVENTS.LOGOUT, onLogout)
      window.removeEventListener(AUTH_EVENTS.TOKENS_REFRESHED, onRefreshed)
      window.removeEventListener(AUTH_EVENTS.PASSWORD_CHANGE_REQUIRED, onPasswordChangeRequired)
    }
  }, [clearSession])

  const applyTokens = useCallback(
    async (tokens: TokenPair) => {
      tokenStorage.save(tokens)
      setUser(tokens.user)
      setStatus('authenticated')
      if (!tokens.user.mustChangePassword) {
        await refreshProfile().catch(() => undefined)
      }
    },
    [refreshProfile],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login(email, password)
      queryClient.clear()
      await applyTokens(tokens)
      return tokens.user
    },
    [applyTokens, queryClient],
  )

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken()
    if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined)
    clearSession()
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      employee,
      isHr: user?.role === 'ADMIN_HR',
      login,
      logout,
      applyTokens,
      refreshProfile,
    }),
    [status, user, employee, login, logout, applyTokens, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
