import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { employeesApi } from '@/api/employees.api'
import { queryKeys } from '@/api/query-keys'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { getErrorMessage } from '@/lib/api-client'
import type { Employee } from '@/types/api'
import { TempPasswordDialog, type TempPasswordInfo } from './TempPasswordDialog'

type PendingAction = { kind: 'status'; employee: Employee } | { kind: 'reset'; employee: Employee }

/**
 * Aksi karyawan yang butuh konfirmasi (aktif/nonaktif, reset password).
 * Mengembalikan pemicu aksi + elemen dialog yang harus dirender sekali di halaman.
 */
export function useEmployeeActions() {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [tempPassword, setTempPassword] = useState<TempPasswordInfo | null>(null)

  const statusMutation = useMutation({
    mutationFn: (employee: Employee) => employeesApi.setStatus(employee.id, !employee.isActive),
    onSuccess: (updated) => {
      toast.success(`${updated.fullName} ${updated.isActive ? 'diaktifkan kembali' : 'dinonaktifkan'}`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      setPending(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const resetMutation = useMutation({
    mutationFn: (employee: Employee) => employeesApi.resetPassword(employee.id),
    onSuccess: ({ temporaryPassword }, employee) => {
      setPending(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employee.id) })
      setTempPassword({ title: 'Password berhasil direset', email: employee.email, temporaryPassword })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const target = pending?.employee
  const deactivating = pending?.kind === 'status' && !!target?.isActive

  const element = (
    <>
      <ConfirmDialog
        open={pending?.kind === 'status'}
        onOpenChange={(open) => !open && setPending(null)}
        title={deactivating ? `Nonaktifkan ${target?.fullName}?` : `Aktifkan ${target?.fullName}?`}
        description={
          deactivating
            ? 'Karyawan tidak akan bisa login maupun absen, dan sesi aktifnya akan dicabut. Riwayat absensi tetap tersimpan.'
            : 'Karyawan dapat kembali login dan melakukan absensi.'
        }
        confirmLabel={deactivating ? 'Nonaktifkan' : 'Aktifkan'}
        destructive={deactivating}
        loading={statusMutation.isPending}
        onConfirm={() => target && statusMutation.mutate(target)}
      />
      <ConfirmDialog
        open={pending?.kind === 'reset'}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Reset password ${target?.fullName}?`}
        description="Password lama tidak berlaku lagi dan karyawan wajib mengganti password sementara saat login."
        confirmLabel="Reset password"
        loading={resetMutation.isPending}
        onConfirm={() => target && resetMutation.mutate(target)}
      />
      <TempPasswordDialog info={tempPassword} onClose={() => setTempPassword(null)} />
    </>
  )

  return {
    requestToggleStatus: (employee: Employee) => setPending({ kind: 'status', employee }),
    requestResetPassword: (employee: Employee) => setPending({ kind: 'reset', employee }),
    showTempPassword: setTempPassword,
    element,
  }
}
