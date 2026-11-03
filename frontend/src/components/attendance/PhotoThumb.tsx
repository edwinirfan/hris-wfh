import { useState } from 'react'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PhotoThumbProps {
  src: string | null | undefined
  name: string
  className?: string
}

/** Thumbnail foto absen; jatuh ke inisial bila foto tidak ada / URL kedaluwarsa */
export function PhotoThumb({ src, name, className }: PhotoThumbProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src && failedSrc !== src

  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-1 ring-border',
        className,
      )}
    >
      {showImage ? (
        <img src={src} alt={`Foto ${name}`} className="size-full object-cover" loading="lazy" onError={() => setFailedSrc(src)} />
      ) : (
        initials(name)
      )}
    </div>
  )
}
