import { zodResolver } from '@hookform/resolvers/zod'
import { Check, KeyRound, Loader2, LogOut, X } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/common/FormField'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { authApi } from '@/api/auth.api'
import { useAuth } from '@/features/auth/auth-context'
import { PASSWORD_MESSAGE, PASSWORD_REGEX, PASSWORD_RULES } from '@/features/auth/password-rules'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini wajib diisi').max(128),
    newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_MESSAGE),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak sama',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Password baru harus berbeda dari password saat ini',
  })

type Values = z.infer<typeof schema>

export function ChangePasswordPage() {
  const { user, applyTokens, logout } = useAuth()
  const navigate = useNavigate()
  const forced = !!user?.mustChangePassword

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const newPassword = useWatch({ control: form.control, name: 'newPassword' })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const tokens = await authApi.changePassword(values.currentPassword, values.newPassword)
      await applyTokens(tokens)
      toast.success('Password berhasil diganti')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  })

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="text-xl">Ganti password</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          {forced && (
            <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
              <AlertTitle>Password sementara</AlertTitle>
              <AlertDescription className="text-amber-900">
                Akun Anda masih memakai password sementara dari HR. Ganti password terlebih dahulu untuk melanjutkan.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormField
              id="currentPassword"
              label={forced ? 'Password sementara' : 'Password saat ini'}
              error={errors.currentPassword?.message}
            >
              <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register('currentPassword')} />
            </FormField>
            <FormField id="newPassword" label="Password baru" error={errors.newPassword?.message}>
              <Input id="newPassword" type="password" autoComplete="new-password" {...form.register('newPassword')} />
            </FormField>
            <ul className="grid grid-cols-2 gap-1 text-xs">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(newPassword ?? '')
                return (
                  <li key={rule.id} className={cn('flex items-center gap-1', ok ? 'text-emerald-600' : 'text-muted-foreground')}>
                    {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    {rule.label}
                  </li>
                )
              })}
            </ul>
            <FormField id="confirmPassword" label="Ulangi password baru" error={errors.confirmPassword?.message}>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
            </FormField>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {forced ? (
                <Button type="button" variant="ghost" onClick={() => void logout()}>
                  <LogOut /> Keluar
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Batal
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Simpan password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
