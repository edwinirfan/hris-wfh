import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/config/env'
import { tokenStorage } from '@/lib/token-storage'
import type { ApiEnvelope, ApiErrorBody, TokenPair } from '@/types/api'

export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED'

/** Event global yang didengarkan AuthProvider */
export const AUTH_EVENTS = {
  LOGOUT: 'hris:auth-logout',
  TOKENS_REFRESHED: 'hris:auth-refreshed',
  PASSWORD_CHANGE_REQUIRED: 'hris:password-change-required',
} as const

export class ApiError extends Error {
  readonly status: number
  readonly errors: string[]

  constructor(status: number, message: string, errors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 30_000,
})

http.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout']

/**
 * Satu refresh yang sedang berjalan dipakai bersama oleh semua request yang gagal 401
 * secara bersamaan — request lain "mengantri" dengan menunggu promise yang sama.
 */
let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) throw new ApiError(401, 'Sesi berakhir, silakan login kembali')

  // axios polos (tanpa interceptor) supaya tidak terjadi loop refresh
  const { data } = await axios.post<ApiEnvelope<TokenPair>>(`${env.apiUrl}/auth/refresh`, { refreshToken })
  tokenStorage.save(data.data)
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.TOKENS_REFRESHED, { detail: data.data.user }))
  return data.data.accessToken
}

function forceLogout() {
  tokenStorage.clear()
  window.dispatchEvent(new Event(AUTH_EVENTS.LOGOUT))
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiErrorBody> | undefined
    if (error.response) {
      const status = error.response.status
      const message =
        typeof body?.message === 'string'
          ? body.message
          : status === 413
            ? 'Ukuran file terlalu besar (maks. 2 MB)'
            : `Permintaan gagal (${status})`
      return new ApiError(status, message, Array.isArray(body?.errors) ? body.errors : [])
    }
    if (error.code === 'ECONNABORTED') return new ApiError(0, 'Koneksi ke server timeout')
    return new ApiError(0, 'Tidak dapat terhubung ke server')
  }
  return new ApiError(0, error instanceof Error ? error.message : 'Terjadi kesalahan')
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const url = original?.url ?? ''

    if (status === 401 && original && !original._retry && !NO_REFRESH_PATHS.some((p) => url.includes(p))) {
      original._retry = true
      try {
        refreshInFlight ??= refreshAccessToken().finally(() => {
          refreshInFlight = null
        })
        const accessToken = await refreshInFlight
        original.headers.Authorization = `Bearer ${accessToken}`
        return http(original)
      } catch {
        forceLogout()
        throw new ApiError(401, 'Sesi berakhir, silakan login kembali')
      }
    }

    if (status === 403 && error.response?.data?.message === PASSWORD_CHANGE_REQUIRED) {
      window.dispatchEvent(new Event(AUTH_EVENTS.PASSWORD_CHANGE_REQUIRED))
    }

    throw toApiError(error)
  },
)

/* Helper yang langsung membuka envelope { success, data } */

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<ApiEnvelope<T>>(url, config)
  return data.data
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<ApiEnvelope<T>>(url, body, config)
  return data.data
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.patch<ApiEnvelope<T>>(url, body, config)
  return data.data
}

/** Pesan error yang ramah untuk toast */
export function getErrorMessage(error: unknown): string {
  const apiError = toApiError(error)
  if (apiError.status === 400 && apiError.errors.length > 0) {
    return apiError.errors.slice(0, 3).join(' · ')
  }
  if (apiError.status === 429) return 'Terlalu banyak percobaan, tunggu sebentar lalu coba lagi'
  return apiError.message
}
