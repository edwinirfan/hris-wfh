import { apiGet, apiPost } from '@/lib/api-client'
import type { MeResponse, ServerTime, TokenPair } from '@/types/api'

export const authApi = {
  login: (email: string, password: string) => apiPost<TokenPair>('/auth/login', { email, password }),
  logout: (refreshToken: string) => apiPost<null>('/auth/logout', { refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiPost<TokenPair>('/auth/change-password', { currentPassword, newPassword }),
  me: () => apiGet<MeResponse>('/auth/me'),
}

export const timeApi = {
  now: () => apiGet<ServerTime>('/time'),
}
