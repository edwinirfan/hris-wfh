import { KeyRound } from 'lucide-react'
import { Link } from 'react-router'
import { DetailList } from '@/components/common/DetailList'
import { PageHeader } from '@/components/common/PageHeader'
import { ActiveBadge, RoleBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'
import { EMPLOYMENT_TYPE_LABEL, formatDate, formatDateTime, GENDER_LABEL, initials } from '@/lib/format'

export function ProfilePage() {
  const { user, employee } = useAuth()
  if (!user) return null

  return (
    <>
      <PageHeader
        title="Profil saya"
        actions={
          <Button asChild variant="outline">
            <Link to="/change-password">
              <KeyRound /> Ganti password
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {initials(employee?.fullName ?? user.email)}
            </span>
            <div>
              <p className="text-lg font-semibold">{employee?.fullName ?? user.email}</p>
              <p className="text-sm text-muted-foreground">{employee?.employeeCode}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              <RoleBadge role={user.role} />
              {employee && <ActiveBadge isActive={employee.isActive} />}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data karyawan</CardTitle>
          </CardHeader>
          <CardContent>
            {employee ? (
              <DetailList
                items={[
                  { label: 'Email', value: employee.email },
                  { label: 'No. HP', value: employee.phone },
                  { label: 'Departemen', value: employee.department.name },
                  { label: 'Jabatan', value: employee.position.name },
                  { label: 'Tipe karyawan', value: EMPLOYMENT_TYPE_LABEL[employee.employmentType] },
                  { label: 'Tanggal bergabung', value: formatDate(employee.joinDate, 'DD MMMM YYYY') },
                  { label: 'Jenis kelamin', value: GENDER_LABEL[employee.gender] },
                  { label: 'Tanggal lahir', value: formatDate(employee.birthDate, 'DD MMMM YYYY') },
                  { label: 'Login terakhir', value: formatDateTime(user.lastLoginAt) },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Data karyawan tidak ditemukan.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
