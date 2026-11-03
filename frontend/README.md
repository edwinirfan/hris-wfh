# HRIS WFH — Frontend

React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui.

```bash
cp .env.example .env      # sesuaikan URL API bila perlu
npm install               # postinstall menyalin wasm MediaPipe & mengunduh model wajah
npm run dev               # http://localhost:5173
npm run build             # typecheck + build produksi
npm run lint
```

Kamera hanya bisa diakses di `localhost` atau HTTPS.

Struktur `src/`:
- `api/` — klien per domain + query keys TanStack Query
- `lib/api-client.ts` — axios: buka envelope `{success,data}`, Bearer token, auto-refresh 401 (satu refresh bersama), event logout / wajib ganti password
- `features/auth` — AuthProvider, aturan password
- `hooks/useFaceDetection.ts` — MediaPipe FaceLandmarker + state machine liveness (kedip)
- `components/attendance` — `CameraCapture`, `LiveClock`, `PhotoViewer`, `PhotoThumb`
- `components/common` — `DataTable<T>`, `StatusBadge`, `StatCard`, `DateRangeFilter`, `ConfirmDialog`, dll.
- `pages/` — halaman karyawan & HR
