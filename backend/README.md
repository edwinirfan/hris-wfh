# HRIS WFH — Backend

NestJS monorepo: `api-gateway`, `auth-service`, `employee-service`, `attendance-service` + `libs/common`.
Dokumentasi lengkap (arsitektur, validasi, cara menjalankan) ada di [README utama](../README.md),
kontrak API di [docs/API.md](../docs/API.md), struktur database di [docs/ERD.md](../docs/ERD.md).

```bash
cp .env.example .env
npm install
npm run dev                  # keempat service sekaligus (watch mode)
npm test                     # unit test
bash scripts/smoke-test.sh   # smoke test end-to-end (stack harus berjalan)
```
