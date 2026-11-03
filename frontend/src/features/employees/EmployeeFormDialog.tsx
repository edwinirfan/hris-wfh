import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { employeesApi } from '@/api/employees.api'
import { queryKeys } from '@/api/query-keys'
import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, getErrorMessage } from '@/lib/api-client'
import { EMPLOYMENT_TYPE_LABEL, GENDER_LABEL, ROLE_LABEL } from '@/lib/format'
import type { CreateEmployeeResponse, Employee } from '@/types/api'
import { employeeSchema, normalizeCode, normalizeEmail, normalizePhone, type EmployeeFormValues } from './employee.schema'
import { useDepartments, usePositions } from './useMasterData'

interface EmployeeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ada → mode edit */
  employee?: Employee | null
  onCreated?: (result: CreateEmployeeResponse) => void
}

const EMPTY: EmployeeFormValues = {
  employeeCode: '',
  fullName: '',
  email: '',
  phone: '',
  gender: 'MALE',
  birthDate: '',
  departmentId: '',
  positionId: '',
  joinDate: '',
  employmentType: 'PERMANENT',
  role: 'EMPLOYEE',
}

function toFormValues(employee: Employee): EmployeeFormValues {
  return {
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    gender: employee.gender,
    birthDate: employee.birthDate,
    departmentId: employee.department.id,
    positionId: employee.position.id,
    joinDate: employee.joinDate,
    employmentType: employee.employmentType,
  }
}

export function EmployeeFormDialog({ open, onOpenChange, employee, onCreated }: EmployeeFormDialogProps) {
  const isEdit = !!employee
  const queryClient = useQueryClient()
  const departments = useDepartments()

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: EMPTY,
  })
  const { errors } = form.formState
  const departmentId = useWatch({ control: form.control, name: 'departmentId' })
  const positions = usePositions(departmentId || undefined)

  // Isi ulang form hanya saat dialog baru dibuka — refetch data di latar belakang tidak menimpa isian
  const wasOpen = useRef(false)
  // versi data saat form dibuka → dikirim untuk optimistic locking (409 bila sudah diubah HR lain)
  const openedVersion = useRef<number | null>(null)
  useEffect(() => {
    if (open && !wasOpen.current) {
      form.reset(employee ? toFormValues(employee) : EMPTY)
      openedVersion.current = employee?.version ?? null
    }
    wasOpen.current = open
  }, [open, employee, form])

  const mutation = useMutation({
    mutationFn: async (values: EmployeeFormValues) => {
      const payload = {
        employeeCode: normalizeCode(values.employeeCode),
        fullName: values.fullName.trim(),
        email: normalizeEmail(values.email),
        phone: normalizePhone(values.phone),
        gender: values.gender,
        birthDate: values.birthDate,
        departmentId: values.departmentId,
        positionId: values.positionId,
        joinDate: values.joinDate,
        employmentType: values.employmentType,
      }
      if (employee) {
        await employeesApi.update(employee.id, { ...payload, version: openedVersion.current ?? employee.version })
        return null
      }
      return employeesApi.create({ ...payload, role: values.role ?? 'EMPLOYEE' })
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      onOpenChange(false)
      if (created) {
        toast.success(`${created.employee.fullName} berhasil ditambahkan`)
        onCreated?.(created)
      } else {
        toast.success('Data karyawan berhasil diperbarui')
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
      // 409 versi berubah → muat ulang data supaya form berikutnya memakai versi terbaru
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      }
    },
  })

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit karyawan' : 'Tambah karyawan'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Perubahan akan ditolak bila data sudah diubah HR lain sejak form dibuka.'
              : 'Akun login dibuat otomatis dengan password sementara.'}
          </DialogDescription>
        </DialogHeader>

        <form id="employee-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField id="employeeCode" label="NIK" required error={errors.employeeCode?.message} hint="Contoh: DXA-0012">
            <Input
              id="employeeCode"
              className="uppercase"
              aria-invalid={!!errors.employeeCode}
              {...form.register('employeeCode', { setValueAs: (v: string) => normalizeCode(v) })}
            />
          </FormField>
          <FormField id="fullName" label="Nama lengkap" required error={errors.fullName?.message}>
            <Input id="fullName" aria-invalid={!!errors.fullName} {...form.register('fullName')} />
          </FormField>
          <FormField id="email" label="Email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              aria-invalid={!!errors.email}
              {...form.register('email', { setValueAs: (v: string) => normalizeEmail(v) })}
            />
          </FormField>
          <FormField id="phone" label="No. HP" required error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="081234567890"
              aria-invalid={!!errors.phone}
              {...form.register('phone', { setValueAs: (v: string) => normalizePhone(v) })}
            />
          </FormField>

          <FormField id="gender" label="Jenis kelamin" required error={errors.gender?.message}>
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['MALE', 'FEMALE'] as const).map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField id="birthDate" label="Tanggal lahir" required error={errors.birthDate?.message}>
            <Input id="birthDate" type="date" aria-invalid={!!errors.birthDate} {...form.register('birthDate')} />
          </FormField>

          <FormField id="departmentId" label="Departemen" required error={errors.departmentId?.message}>
            <Controller
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value)
                    // jabatan bergantung pada departemen
                    form.setValue('positionId', '', { shouldValidate: form.formState.isSubmitted })
                  }}
                >
                  <SelectTrigger id="departmentId" className="w-full" aria-invalid={!!errors.departmentId}>
                    <SelectValue placeholder={departments.isLoading ? 'Memuat…' : 'Pilih departemen'} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.data?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField id="positionId" label="Jabatan" required error={errors.positionId?.message}>
            <Controller
              control={form.control}
              name="positionId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!departmentId}>
                  <SelectTrigger id="positionId" className="w-full" aria-invalid={!!errors.positionId}>
                    <SelectValue
                      placeholder={!departmentId ? 'Pilih departemen dulu' : positions.isLoading ? 'Memuat…' : 'Pilih jabatan'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.data?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField id="joinDate" label="Tanggal bergabung" required error={errors.joinDate?.message}>
            <Input id="joinDate" type="date" aria-invalid={!!errors.joinDate} {...form.register('joinDate')} />
          </FormField>
          <FormField id="employmentType" label="Tipe karyawan" required error={errors.employmentType?.message}>
            <Controller
              control={form.control}
              name="employmentType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="employmentType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['PERMANENT', 'CONTRACT', 'INTERN'] as const).map((t) => (
                      <SelectItem key={t} value={t}>
                        {EMPLOYMENT_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          {!isEdit && (
            <FormField id="role" label="Role akun" hint="Admin HR dapat mengelola karyawan & melihat absensi.">
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['EMPLOYEE', 'ADMIN_HR'] as const).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="submit" form="employee-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            {isEdit ? 'Simpan perubahan' : 'Tambah karyawan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
