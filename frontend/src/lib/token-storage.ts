import type { AuthUser, TokenPair } from '@/types/api'

const ACCESS_KEY = 'hris.accessToken'
const REFRESH_KEY = 'hris.refreshToken'
const USER_KEY = 'hris.user'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage penuh / diblokir — sesi tetap berjalan di memori */
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* abaikan */
  }
}

export const tokenStorage = {
  getAccessToken: () => safeGet(ACCESS_KEY),
  getRefreshToken: () => safeGet(REFRESH_KEY),
  getUser(): AuthUser | null {
    const raw = safeGet(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  },
  save(tokens: TokenPair) {
    safeSet(ACCESS_KEY, tokens.accessToken)
    safeSet(REFRESH_KEY, tokens.refreshToken)
    safeSet(USER_KEY, JSON.stringify(tokens.user))
  },
  saveUser(user: AuthUser) {
    safeSet(USER_KEY, JSON.stringify(user))
  },
  clear() {
    safeRemove(ACCESS_KEY)
    safeRemove(REFRESH_KEY)
    safeRemove(USER_KEY)
  },
}
