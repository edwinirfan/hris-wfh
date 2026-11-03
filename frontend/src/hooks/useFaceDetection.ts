import { FaceLandmarker, FilesetResolver, type Classifications, type FaceLandmarkerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type FaceStatus =
  | 'LOADING_MODEL'
  | 'MODEL_ERROR'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'TOO_FAR'
  | 'TOO_DARK'
  | 'READY'
  | 'BLINK_CHALLENGE'
  | 'CAPTURED'

export type BlinkStage = 'WAIT_CLOSE' | 'WAIT_OPEN'

export interface LivenessSnapshot {
  faceCount: number
  faceConfidence: number
}

const BASE = import.meta.env.BASE_URL
const WASM_PATH = `${BASE}mediapipe/wasm`
const MODEL_PATH = `${BASE}models/face_landmarker.task`

/** Ambang skor deteksi & presence internal FaceLandmarker */
const MIN_DETECTION_CONFIDENCE = 0.6
/** Lebar wajah minimal (proporsi lebar frame) */
const MIN_FACE_WIDTH = 0.22
const FULL_SIZE_FACE_WIDTH = 0.45
/** Rata-rata luminance (0–255) minimal */
const MIN_BRIGHTNESS = 60
const BRIGHTNESS_INTERVAL_MS = 400
/** Wajah harus stabil selama ini sebelum tantangan kedip dimulai */
const READY_STABLE_MS = 700
const BLINK_CLOSED = 0.5
const BLINK_OPEN = 0.2

/* ---------- Model dimuat sekali dan dipakai ulang antar halaman ---------- */

let landmarkerPromise: Promise<FaceLandmarker> | null = null

function loadLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
    const create = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        numFaces: 2, // agar kondisi "lebih dari satu wajah" bisa dikenali
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: MIN_DETECTION_CONFIDENCE,
        minFacePresenceConfidence: MIN_DETECTION_CONFIDENCE,
        minTrackingConfidence: 0.5,
      })
    try {
      return await create('GPU')
    } catch {
      return await create('CPU') // WebGL tidak tersedia
    }
  })().catch((error: unknown) => {
    landmarkerPromise = null
    throw error
  })
  return landmarkerPromise
}

/* ---------- Helper per frame ---------- */

interface Box {
  minX: number
  minY: number
  width: number
  height: number
  centerX: number
  centerY: number
}

function boundingBox(landmarks: NormalizedLandmark[]): Box {
  let minX = 1, minY = 1, maxX = 0, maxY = 0
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * FaceLandmarker tidak mengekspos skor deteksi. Wajah hanya dikembalikan bila skor
 * deteksi & presence internalnya ≥ MIN_DETECTION_CONFIDENCE (0.6), jadi nilai itu dipakai
 * sebagai baseline, lalu sisa 0.4 diisi oleh kualitas frame:
 *  - completeness (40%): proporsi landmark yang berada di dalam frame (wajah tidak terpotong)
 *  - size (30%): lebar wajah, 0 pada MIN_FACE_WIDTH → 1 pada FULL_SIZE_FACE_WIDTH
 *  - stability (30%): 1 − pergeseran pusat wajah antar-frame (gerakan cepat = foto blur)
 * Hasilnya selalu ≥ 0.6 saat wajah jelas terdeteksi dan dihaluskan dengan EMA.
 */
function frameQuality(landmarks: NormalizedLandmark[], box: Box, prevCenter: { x: number; y: number } | null): number {
  const inside = landmarks.filter((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1).length
  const completeness = inside / landmarks.length
  const size = clamp01((box.width - MIN_FACE_WIDTH) / (FULL_SIZE_FACE_WIDTH - MIN_FACE_WIDTH))
  const movement = prevCenter ? Math.hypot(box.centerX - prevCenter.x, box.centerY - prevCenter.y) : 0
  const stability = clamp01(1 - movement / 0.05)
  return clamp01(0.4 * completeness + 0.3 * size + 0.3 * stability)
}

function blinkScores(blendshapes: Classifications | undefined) {
  let left = 0
  let right = 0
  for (const c of blendshapes?.categories ?? []) {
    if (c.categoryName === 'eyeBlinkLeft') left = c.score
    else if (c.categoryName === 'eyeBlinkRight') right = c.score
  }
  return { left, right }
}

/* ---------- Hook ---------- */

interface UseFaceDetectionOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  /** true selama kamera menyala dan foto belum diambil */
  active: boolean
  /** Dipanggil sekali saat tantangan kedip lolos — saat itulah foto diambil */
  onLivenessPassed: (snapshot: LivenessSnapshot) => void
}

/**
 * State machine verifikasi wajah:
 * LOADING_MODEL → NO_FACE | MULTIPLE_FACES | TOO_FAR | TOO_DARK → READY
 *   → BLINK_CHALLENGE (kedua mata > 0.5 lalu < 0.2) → CAPTURED
 * Kondisi gagal kapan pun mengembalikan proses ke awal (wajah harus hadir terus-menerus).
 */
export function useFaceDetection({ videoRef, active, onLivenessPassed }: UseFaceDetectionOptions) {
  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null)
  const [status, setStatusState] = useState<FaceStatus>('LOADING_MODEL')
  const [blinkStage, setBlinkStageState] = useState<BlinkStage>('WAIT_CLOSE')
  const [faceConfidence, setFaceConfidence] = useState(0)
  const [modelError, setModelError] = useState<string | null>(null)

  const statusRef = useRef<FaceStatus>('LOADING_MODEL')
  const blinkStageRef = useRef<BlinkStage>('WAIT_CLOSE')
  const stableSinceRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const prevCenterRef = useRef<{ x: number; y: number } | null>(null)
  const confidenceRef = useRef(0)
  const brightnessRef = useRef(255)
  const lastBrightnessAtRef = useRef(0)
  const brightnessCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const onPassedRef = useRef(onLivenessPassed)

  useEffect(() => {
    onPassedRef.current = onLivenessPassed
  }, [onLivenessPassed])

  const setStatus = useCallback((next: FaceStatus) => {
    if (statusRef.current === next) return
    statusRef.current = next
    setStatusState(next)
  }, [])

  const setBlinkStage = useCallback((next: BlinkStage) => {
    if (blinkStageRef.current === next) return
    blinkStageRef.current = next
    setBlinkStageState(next)
  }, [])

  // Muat model
  useEffect(() => {
    let cancelled = false
    loadLandmarker()
      .then((instance) => {
        if (cancelled) return
        setLandmarker(instance)
        setStatus('NO_FACE')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('FaceLandmarker gagal dimuat', error)
        setModelError('Model pendeteksi wajah gagal dimuat. Periksa koneksi lalu muat ulang halaman.')
        setStatus('MODEL_ERROR')
      })
    return () => {
      cancelled = true
    }
  }, [setStatus])

  const measureBrightness = useCallback((video: HTMLVideoElement) => {
    const canvas = (brightnessCanvasRef.current ??= document.createElement('canvas'))
    canvas.width = 32
    canvas.height = 24
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return 255
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let total = 0
    for (let i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return total / (data.length / 4)
  }, [])

  const processFrame = useCallback(
    (result: FaceLandmarkerResult, video: HTMLVideoElement) => {
      if (statusRef.current === 'CAPTURED') return
      const now = performance.now()

      const fail = (next: FaceStatus) => {
        prevCenterRef.current = null
        setBlinkStage('WAIT_CLOSE')
        setStatus(next)
      }

      const faces = result.faceLandmarks
      if (faces.length === 0) return fail('NO_FACE')
      if (faces.length > 1) return fail('MULTIPLE_FACES')

      const landmarks = faces[0]
      const box = boundingBox(landmarks)
      if (box.width < MIN_FACE_WIDTH) return fail('TOO_FAR')

      if (now - lastBrightnessAtRef.current > BRIGHTNESS_INTERVAL_MS) {
        brightnessRef.current = measureBrightness(video)
        lastBrightnessAtRef.current = now
      }
      if (brightnessRef.current < MIN_BRIGHTNESS) return fail('TOO_DARK')

      const quality = frameQuality(landmarks, box, prevCenterRef.current)
      prevCenterRef.current = { x: box.centerX, y: box.centerY }
      const instant = MIN_DETECTION_CONFIDENCE + (1 - MIN_DETECTION_CONFIDENCE) * quality
      confidenceRef.current = confidenceRef.current === 0 ? instant : confidenceRef.current * 0.8 + instant * 0.2

      const current = statusRef.current
      if (current !== 'READY' && current !== 'BLINK_CHALLENGE') {
        stableSinceRef.current = now
        setFaceConfidence(confidenceRef.current)
        setStatus('READY')
        return
      }

      if (current === 'READY') {
        if (now - stableSinceRef.current >= READY_STABLE_MS) {
          setFaceConfidence(confidenceRef.current)
          setBlinkStage('WAIT_CLOSE')
          setStatus('BLINK_CHALLENGE')
        }
        return
      }

      // BLINK_CHALLENGE
      const { left, right } = blinkScores(result.faceBlendshapes[0])
      if (blinkStageRef.current === 'WAIT_CLOSE') {
        if (left > BLINK_CLOSED && right > BLINK_CLOSED) setBlinkStage('WAIT_OPEN')
      } else if (left < BLINK_OPEN && right < BLINK_OPEN) {
        const confidence = Math.round(clamp01(confidenceRef.current) * 10_000) / 10_000
        setFaceConfidence(confidence)
        setStatus('CAPTURED')
        onPassedRef.current({ faceCount: 1, faceConfidence: confidence })
      }
    },
    [measureBrightness, setBlinkStage, setStatus],
  )

  // Loop deteksi per frame video
  useEffect(() => {
    if (!active || !landmarker) return
    let frame = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const video = videoRef.current
      if (video && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        try {
          processFrame(landmarker.detectForVideo(video, performance.now()), video)
        } catch (error) {
          console.warn('Deteksi frame gagal', error)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [active, landmarker, processFrame, videoRef])

  /** Mulai ulang (ambil ulang foto) */
  const reset = useCallback(() => {
    prevCenterRef.current = null
    confidenceRef.current = 0
    lastVideoTimeRef.current = -1
    setFaceConfidence(0)
    setBlinkStage('WAIT_CLOSE')
    statusRef.current = landmarker ? 'NO_FACE' : statusRef.current
    setStatusState(statusRef.current)
  }, [landmarker, setBlinkStage])

  return { status, blinkStage, faceConfidence, modelError, reset }
}
