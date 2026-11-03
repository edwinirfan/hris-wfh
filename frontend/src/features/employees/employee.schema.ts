import { z } from 'zod'
import { dayjs, DATE_FORMAT, TZ } from '@/lib/format'

/** Aturan sama dengan validasi backend (libs/common validators) */
export const EMPLOYEE_CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{2,19}$/
export const PHONE_REGEX = /^(\+62|62|0)8[1-9]\d{6,10}$/
export const PERSON_NAME_REGEX = /^[\p{L} .'-]+$/u

const isDate = (value: string) => dayjs(value, DATE_FORMAT, true).isValid()
const ageOf = (birthDate: string) => dayjs().tz(TZ).diff(dayjs(birthDate, DATE_FORMAT), 'year')

export const employeeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .regex(EMPLOYEE_CODE_REGEX, { message: 'NIK hanya huruf besar, angka, dan strip (3–20 karakter)' }),
  fullName: z
    .string()
    .trim()
    .min(3, { message: 'Nama lengkap minimal 3 karakter' })
    .max(100, { message: 'Nama lengkap maksimal 100 karakter' })
    .regex(PERSON_NAME_REGEX, { message: 'Nama hanya boleh huruf, spasi, titik, petik, dan strip' }),
  email: z.string().trim().max(150).email({ message: 'Format email tidak valid' }),
  phone: z.string().regex(PHONE_REGEX, { message: 'Nomor HP tidak valid (contoh: 081234567890)' }),
  gender: z.enum(['MALE', 'FEMALE'], { message: 'Pilih jenis kelamin' }),
  birthDate: z
    .string()
    .refine(isDate, { message: 'Tanggal lahir wajib diisi' })
    .refine((v) => !isDate(v) || ageOf(v) >= 17, { message: 'Usia minimal 17 tahun' })
    .refine((v) => !isDate(v) || ageOf(v) <= 70, { message: 'Usia maksimal 70 tahun' }),
  departmentId: z.string().min(1, { message: 'Pilih departemen' }),
  positionId: z.string().min(1, { message: 'Pilih jabatan' }),
  joinDate: z
    .string()
    .refine(isDate, { message: 'Tanggal bergabung wajib diisi' })
    .refine((v) => !isDate(v) || !dayjs(v, DATE_FORMAT).isAfter(dayjs().tz(TZ).add(30, 'day'), 'day'), {
      message: 'Tanggal bergabung maksimal 30 hari ke depan',
    }),
  employmentType: z.enum(['PERMANENT', 'CONTRACT', 'INTERN'], { message: 'Pilih tipe karyawan' }),
  role: z.enum(['EMPLOYEE', 'ADMIN_HR']).optional(),
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>

/** Normalisasi seperti di backend (uppercase NIK, lowercase email, buang spasi/strip pada HP) */
export const normalizeCode = (value: string) => value.trim().toUpperCase()
export const normalizeEmail = (value: string) => value.trim().toLowerCase()
export const normalizePhone = (value: string) => value.replace(/[\s-]/g, '')
