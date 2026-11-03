import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60svh] items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Halaman tidak ditemukan"
        description="Alamat yang Anda buka tidak tersedia."
        action={
          <Button asChild>
            <Link to="/">Kembali ke beranda</Link>
          </Button>
        }
      />
    </div>
  )
}
