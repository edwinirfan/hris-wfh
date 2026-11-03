import {
  AlertTriangle,
  CameraOff,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  MapPinOff,
  RefreshCw,
  ScanFace,
  Send,
  Sun,
  Users,
  ZoomIn,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useFaceDetection, type BlinkStage, type FaceStatus, type LivenessSnapshot } from '@/hooks/useFaceDetection'
import { useGeolocation, type GeoPosition } from '@/hooks/useGeolocation'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.8

export interface CaptureResult {
  blob: Blob
  width: number
  height: number
  metadata: {
    faceCount: number
    faceConfidence: number
    livenessPassed: boolean
    /** Jam perangkat saat foto diambil (ISO) */
    clientTime: string
  }
  location?: GeoPosition
}

interface CameraCaptureProps {
  onSubmit: (result: CaptureResult) => void | Promise<void>
  submitting?: boolean
  submitLabel?: string
  /** Konten tambahan di tahap pratinjau, mis. kolom catatan */
  extra?: ReactNode
}

type CameraState = { kind: 'starting' } | { kind: 'streaming' } | { kind: 'error'; message: string }

const STATUS_UI: Record<Exclude<FaceStatus, 'BLINK_CHALLENGE'>, { text: string; icon: LucideIcon; tone: 'muted' | 'warn' | 'ok' }> = {
  LOADING_MODEL: { text: 'Memuat pendeteksi wajah…', icon: Loader2, tone: 'muted' },
  MODEL_ERROR: { text: 'Pendeteksi wajah tidak tersedia', icon: AlertTriangle, tone: 'warn' },
  NO_FACE: { text: 'Posisikan wajah Anda di dalam bingkai', icon: ScanFace, tone: 'muted' },
  MULTIPLE_FACES: { text: 'Terdeteksi lebih dari satu wajah', icon: Users, tone: 'warn' },
  TOO_FAR: { text: 'Dekatkan wajah ke kamera', icon: ZoomIn, tone: 'warn' },
  TOO_DARK: { text: 'Terlalu gelap — cari tempat yang lebih terang', icon: Sun, tone: 'warn' },
  READY: { text: 'Wajah terdeteksi, tahan posisi…', icon: ScanFace, tone: 'ok' },
  CAPTURED: { text: 'Foto berhasil diambil', icon: CheckCircle2, tone: 'ok' },
}

const BLINK_UI: Record<BlinkStage, { text: string; icon: LucideIcon }> = {
  WAIT_CLOSE: { text: 'Kedipkan kedua mata Anda', icon: EyeOff },
  WAIT_OPEN: { text: 'Bagus! Buka mata kembali…', icon: Eye },
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu muat ulang halaman.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera tidak ditemukan pada perangkat ini.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.'
    default:
      return 'Kamera tidak dapat diakses.'
  }
}

/** Ambil frame video → JPEG (sisi terpanjang maks. 1280px) */
function grabFrame(video: HTMLVideoElement): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight))
  const width = Math.round(video.videoWidth * scale)
  const height = Math.round(video.videoHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas tidak tersedia'))
  ctx.drawImage(video, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error('Gagal membuat foto'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  )
}

/**
 * Kamera selfie dengan verifikasi wajah + liveness (kedip).
 * Foto hanya bisa berasal dari kamera langsung — tidak ada pemilih file.
 */
export function CameraCapture({ onSubmit, submitting, submitLabel = 'Kirim absen', extra }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<CameraState>({ kind: 'starting' })
  const [captured, setCaptured] = useState<CaptureResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const geo = useGeolocation()

  // Nyalakan kamera depan
  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera({ kind: 'error', message: 'Kamera hanya dapat diakses melalui HTTPS atau localhost.' })
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) return
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        if (!cancelled) setCamera({ kind: 'streaming' })
      } catch (error) {
        if (!cancelled) setCamera({ kind: 'error', message: cameraErrorMessage(error) })
      }
    }

    void start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  // Bebaskan object URL pratinjau
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleLivenessPassed = useCallback(
    async ({ faceCount, faceConfidence }: LivenessSnapshot) => {
      const video = videoRef.current
      if (!video) return
      try {
        const frame = await grabFrame(video)
        setCaptured({
          ...frame,
          metadata: { faceCount, faceConfidence, livenessPassed: true, clientTime: new Date().toISOString() },
        })
        setPreviewUrl(URL.createObjectURL(frame.blob))
        setCaptureError(null)
      } catch (error) {
        setCaptureError(error instanceof Error ? error.message : 'Gagal mengambil foto')
      }
    },
    [],
  )

  const detection = useFaceDetection({
    videoRef,
    active: camera.kind === 'streaming' && !captured,
    onLivenessPassed: handleLivenessPassed,
  })

  const retake = () => {
    setCaptured(null)
    setPreviewUrl(null)
    setCaptureError(null)
    detection.reset()
  }

  const submit = () => {
    if (!captured) return
    void onSubmit({ ...captured, location: geo.position ?? undefined })
  }

  if (camera.kind === 'error') {
    return (
      <Alert variant="destructive">
        <CameraOff />
        <AlertTitle>Kamera tidak tersedia</AlertTitle>
        <AlertDescription>
          <p>{camera.message}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
            <RefreshCw /> Muat ulang
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const ui =
    detection.status === 'BLINK_CHALLENGE'
      ? { ...BLINK_UI[detection.blinkStage], tone: 'ok' as const }
      : STATUS_UI[detection.status]
  const StatusIcon = ui.icon
  const ringColor =
    detection.status === 'READY' || detection.status === 'BLINK_CHALLENGE' || detection.status === 'CAPTURED'
      ? 'border-emerald-400'
      : ui.tone === 'warn'
        ? 'border-amber-400'
        : 'border-white/80'

  return (
    <div className="grid gap-4">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 sm:aspect-[4/3]">
        {/* Video dicerminkan agar terasa seperti cermin; foto yang disimpan tidak dicerminkan */}
        <video
          ref={videoRef}
          className={cn('size-full -scale-x-100 object-cover', captured && 'invisible')}
          playsInline
          muted
          autoPlay
        />

        {previewUrl && (
          <img src={previewUrl} alt="Pratinjau foto absen" className="absolute inset-0 size-full object-cover" />
        )}

        {!captured && (
          <>
            <div
              className={cn(
                'pointer-events-none absolute top-1/2 left-1/2 h-[68%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] transition-colors sm:w-[42%]',
                ringColor,
                detection.status === 'BLINK_CHALLENGE' && 'animate-pulse',
              )}
              aria-hidden
            />
            {camera.kind === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                <Loader2 className="mr-2 size-4 animate-spin" /> Menyalakan kamera…
              </div>
            )}
          </>
        )}

        <div
          className={cn(
            'absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-sm font-medium backdrop-blur',
            ui.tone === 'warn' ? 'bg-amber-500/90 text-white' : ui.tone === 'ok' ? 'bg-emerald-600/90 text-white' : 'bg-slate-900/70 text-white',
          )}
          role="status"
          aria-live="polite"
        >
          <StatusIcon className={cn('size-4 shrink-0', detection.status === 'LOADING_MODEL' && 'animate-spin')} />
          <span>{ui.text}</span>
        </div>

        {detection.status === 'BLINK_CHALLENGE' && (
          <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs text-white">
            <StepDot done={detection.blinkStage === 'WAIT_OPEN'} label="Tutup mata" />
            <span className="h-px w-4 bg-white/40" />
            <StepDot done={false} label="Buka mata" />
          </div>
        )}
      </div>

      {detection.modelError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Verifikasi wajah tidak dapat dijalankan</AlertTitle>
          <AlertDescription>
            <p>{detection.modelError} Absensi memerlukan verifikasi wajah.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
              <RefreshCw /> Muat ulang
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {captureError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{captureError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <LocationChip status={geo.status} position={geo.position} />
        {captured && (
          <>
            <Chip icon={ScanFace}>1 wajah · {formatPercent(captured.metadata.faceConfidence)}</Chip>
            <Chip icon={CheckCircle2} tone="ok">
              Liveness lolos
            </Chip>
            <Chip>
              {captured.width}×{captured.height} · {Math.round(captured.blob.size / 1024)} KB
            </Chip>
          </>
        )}
      </div>

      {captured ? (
        <div className="mx-auto grid w-full max-w-md gap-3">
          {extra}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={retake} disabled={submitting}>
              <RefreshCw /> Ambil ulang
            </Button>
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              {submitLabel}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mx-auto grid max-w-md gap-1 text-xs text-muted-foreground">
          <li>• Pastikan hanya wajah Anda yang terlihat dan pencahayaan cukup.</li>
          <li>• Saat bingkai berwarna hijau, kedipkan mata — foto diambil otomatis.</li>
        </ul>
      )}
    </div>
  )
}

function StepDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('size-2 rounded-full', done ? 'bg-emerald-400' : 'bg-white/50')} />
      {label}
    </span>
  )
}

function Chip({ icon: Icon, tone, children }: { icon?: LucideIcon; tone?: 'ok' | 'warn'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1',
        tone === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
        !tone && 'bg-card text-muted-foreground',
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  )
}

function LocationChip({ status, position }: { status: string; position: GeoPosition | null }) {
  if (status === 'pending') return <Chip icon={MapPin}>Mendeteksi lokasi…</Chip>
  if (status === 'granted' && position) {
    return (
      <Chip icon={MapPin} tone="ok">
        Lokasi ±{Math.round(position.accuracy)} m
      </Chip>
    )
  }
  return (
    <Chip icon={MapPinOff} tone="warn">
      Lokasi tidak dibagikan (opsional)
    </Chip>
  )
}
