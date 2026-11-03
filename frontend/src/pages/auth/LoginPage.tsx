import { zodResolver } from '@hookform/resolvers/zod'
import { Fingerprint, Loader2, LogIn, MonitorCheck, ScanFace, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { FormField } from '@/components/common/FormField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid').max(150),
  password: z.string().min(1, 'Password wajib diisi').max(128),
})

type LoginValues = z.infer<typeof loginSchema>

const DEMO_ACCOUNTS = [
  { label: 'Admin HR', email: 'admin@hris.local', password: 'Admin@12345' },
  { label: 'Karyawan', email: 'budi@hris.local', password: 'Karyawan@123' },
]

const FEATURES = [
  { icon: ScanFace, text: 'Absen dengan verifikasi wajah & liveness' },
  { icon: ShieldCheck, text: 'Waktu absen tercatat dari jam server' },
  { icon: MonitorCheck, text: 'Monitoring kehadiran realtime untuk HR' },
]

export function LoginPage() {
  const { login, status, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (status === 'authenticated' && user) return <Navigate to={from ?? '/'} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      const loggedIn = await login(values.email, values.password)
      navigate(loggedIn.mustChangePassword ? '/change-password' : (from ?? '/'), { replace: true })
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  })

  const { errors, isSubmitting } = form.formState

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-white">
            <Fingerprint className="size-5" />
          </span>
          <span className="text-lg font-semibold text-white">HRIS WFH</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Absensi kerja dari rumah, tetap terverifikasi.</h2>
          <ul className="mt-8 grid gap-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-accent">
                  <Icon className="size-4.5 text-sidebar-primary" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Zona waktu: Asia/Jakarta (WIB)</p>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
              <Fingerprint className="size-5" />
            </div>
            <CardTitle className="text-xl">Masuk</CardTitle>
            <CardDescription>Gunakan email dan password akun HRIS Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <FormField id="email" label="Email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="nama@perusahaan.com"
                  aria-invalid={!!errors.email}
                  {...form.register('email')}
                />
              </FormField>
              <FormField id="password" label="Password" error={errors.password?.message}>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...form.register('password')}
                />
              </FormField>
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
                Masuk
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-dashed p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Akun demo (klik untuk mengisi)</p>
              <div className="grid gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => {
                      form.setValue('email', account.email, { shouldValidate: true })
                      form.setValue('password', account.password, { shouldValidate: true })
                    }}
                  >
                    <span className="font-medium">{account.label}</span>
                    <span className="font-mono text-muted-foreground">{account.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
