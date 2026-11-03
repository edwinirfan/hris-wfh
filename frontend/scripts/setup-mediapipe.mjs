// Menyalin runtime WASM MediaPipe dan mengunduh model FaceLandmarker ke public/
// supaya aplikasi tidak bergantung pada CDN saat runtime. Dijalankan otomatis via `postinstall`.
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const wasmDest = join(root, 'public/mediapipe/wasm')
const modelDest = join(root, 'public/models/face_landmarker.task')
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// FilesetResolver memilih varian SIMD atau non-SIMD tergantung dukungan browser
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

const exists = async (path) => {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

await mkdir(wasmDest, { recursive: true })
for (const file of WASM_FILES) {
  await copyFile(join(wasmSrc, file), join(wasmDest, file))
}
console.log(`[mediapipe] wasm disalin ke ${wasmDest}`)

if (await exists(modelDest)) {
  console.log('[mediapipe] model sudah ada, lewati unduhan')
} else {
  try {
    await mkdir(dirname(modelDest), { recursive: true })
    const res = await fetch(MODEL_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await writeFile(modelDest, Buffer.from(await res.arrayBuffer()))
    console.log(`[mediapipe] model diunduh ke ${modelDest}`)
  } catch (error) {
    // Tidak menggagalkan install; halaman absen akan menampilkan pesan "model gagal dimuat"
    console.warn(`[mediapipe] gagal mengunduh model: ${error.message}`)
  }
}
