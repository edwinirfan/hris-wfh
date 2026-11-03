/** Mengikuti PASSWORD_REGEX di backend: min 8, huruf besar, huruf kecil, angka */
export const PASSWORD_RULES = [
  { id: 'length', label: 'Minimal 8 karakter', test: (v: string) => v.length >= 8 && v.length <= 64 },
  { id: 'upper', label: 'Mengandung huruf besar', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'Mengandung huruf kecil', test: (v: string) => /[a-z]/.test(v) },
  { id: 'digit', label: 'Mengandung angka', test: (v: string) => /\d/.test(v) },
] as const

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/
export const PASSWORD_MESSAGE = 'Password minimal 8 karakter dan wajib mengandung huruf besar, huruf kecil, serta angka'
