import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface TempPasswordInfo {
  title: string
  email: string
  temporaryPassword: string
}

interface TempPasswordDialogProps {
  info: TempPasswordInfo | null
  onClose: () => void
}

/** Password sementara hanya ditampilkan sekali — HR wajib menyalin & menyerahkannya ke karyawan */
export function TempPasswordDialog({ info, onClose }: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(`Email: ${info.email}\nPassword sementara: ${info.temporaryPassword}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog
      open={!!info}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false)
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <KeyRound className="size-5" />
          </div>
          <DialogTitle>{info?.title}</DialogTitle>
          <DialogDescription>Serahkan kredensial berikut kepada karyawan.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium break-all">{info?.email}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Password sementara</span>
            <code className="rounded bg-background px-2 py-1 font-mono text-base font-semibold tracking-wider ring-1 ring-border">
              {info?.temporaryPassword}
            </code>
          </div>
        </div>

        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <TriangleAlert />
          <AlertDescription className="text-amber-900">
            Password ini hanya ditampilkan sekali. Karyawan wajib menggantinya saat login pertama.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Tersalin' : 'Salin kredensial'}
          </Button>
          <Button onClick={onClose}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
