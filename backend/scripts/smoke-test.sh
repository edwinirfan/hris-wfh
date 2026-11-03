#!/usr/bin/env bash
# Smoke test end-to-end lewat API Gateway (butuh: curl, jq, node).
# Jalankan saat semua service hidup:  bash scripts/smoke-test.sh
# Catatan: login dibatasi 10 request/menit/IP — beri jeda 1 menit bila menjalankan ulang.
set -uo pipefail

API="${API:-http://localhost:3000/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hris.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@12345}"
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0
CODE=""

node "$DIR/make-test-images.js" "$TMP" 4 || { echo "Gagal membuat gambar uji"; exit 1; }

check() { # name expected actual
  if [[ "$3" == "$2" ]]; then
    PASS=$((PASS + 1)); echo "  ✓ $1"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $1 (expected: $2, got: $3) → $(jq -c '.message // .' "$TMP/body" 2>/dev/null | head -c 300)"
  fi
}
call() { # method path token [json]
  local args=(-s -o "$TMP/body" -w '%{http_code}' -X "$1" "$API$2" -H 'Content-Type: application/json')
  [[ -n "$3" ]] && args+=(-H "Authorization: Bearer $3")
  [[ $# -ge 4 ]] && args+=(--data "$4")
  CODE=$(curl "${args[@]}")
}
upload() { # path token file [extra -F ...]
  local path=$1 token=$2 file=$3; shift 3
  CODE=$(curl -s -o "$TMP/body" -w '%{http_code}' -X POST "$API$path" -H "Authorization: Bearer $token" \
    -F "photo=@$file;type=image/jpeg" -F "clientTime=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" "$@")
}
capture_ok=(-F faceCount=1 -F faceConfidence=0.93 -F livenessPassed=true -F latitude=-6.2 -F longitude=106.8166 -F accuracy=20)
body() { jq -r "$1" "$TMP/body"; }

STAMP=$(date +%s)
echo "▶ System"
call GET /health ""; check "health OK" 200 "$CODE"
call GET /time ""; check "server time" 200 "$CODE"

echo "▶ Auth admin HR"
call POST /auth/login "" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"; check "login admin" 200 "$CODE"
ADMIN=$(body .data.accessToken)
call GET /auth/me "$ADMIN"; check "GET /auth/me role" ADMIN_HR "$(body .data.user.role)"
call GET /employees "" ; check "tanpa token → 401" 401 "$CODE"

echo "▶ Master data & validasi karyawan"
call GET /departments "$ADMIN"; check "4 departemen" 4 "$(body '.data | length')"
IT=$(body '.data[] | select(.code=="IT") | .id'); FIN=$(body '.data[] | select(.code=="FIN") | .id')
call GET "/positions?departmentId=$IT" "$ADMIN"; POS_IT=$(body '.data[0].id')
call POST /employees "$ADMIN" "{\"employeeCode\":\"x\",\"fullName\":\"A1\",\"email\":\"bukan-email\",\"phone\":\"12345\",\"gender\":\"MALE\",\"birthDate\":\"2015-01-01\",\"departmentId\":\"$IT\",\"positionId\":\"$POS_IT\",\"joinDate\":\"2099-01-01\",\"employmentType\":\"PERMANENT\"}"
check "payload tidak valid → 400" 400 "$CODE"
check "daftar error validasi ≥ 5" true "$(body '(.errors | length) >= 5')"
NEW_EMP="{\"fullName\":\"Smoke Test\",\"phone\":\"081298765432\",\"gender\":\"FEMALE\",\"birthDate\":\"1999-05-05\",\"joinDate\":\"2025-01-06\",\"employmentType\":\"CONTRACT\""
call POST /employees "$ADMIN" "$NEW_EMP,\"employeeCode\":\"SMK-$STAMP\",\"email\":\"smoke$STAMP@hris.local\",\"departmentId\":\"$FIN\",\"positionId\":\"$POS_IT\"}"
check "jabatan bukan milik departemen → 400" 400 "$CODE"

echo "▶ Saga create employee + akun login"
call POST /employees "$ADMIN" "$NEW_EMP,\"employeeCode\":\"SMK-$STAMP\",\"email\":\"smoke$STAMP@hris.local\",\"departmentId\":\"$IT\",\"positionId\":\"$POS_IT\"}"
check "create employee → 201" 201 "$CODE"
EMP_ID=$(body .data.employee.id); TEMP_PW=$(body .data.account.temporaryPassword)
check "password sementara dikembalikan" true "$(body '.data.account.temporaryPassword | length >= 12')"
call POST /employees "$ADMIN" "$NEW_EMP,\"employeeCode\":\"SMK-$STAMP\",\"email\":\"smoke$STAMP@hris.local\",\"departmentId\":\"$IT\",\"positionId\":\"$POS_IT\"}"
check "NIK/email duplikat → 409" 409 "$CODE"
call POST /employees "$ADMIN" "$NEW_EMP,\"employeeCode\":\"SMKB-$STAMP\",\"email\":\"smokeb$STAMP@hris.local\",\"departmentId\":\"$IT\",\"positionId\":\"$POS_IT\"}"
EMP_B_ID=$(body .data.employee.id); TEMP_PW_B=$(body .data.account.temporaryPassword)
call GET "/employees/$EMP_ID" "$ADMIN"; check "detail menyertakan akun (API composition)" true "$(body .data.account.mustChangePassword)"
call GET "/employees?search=SMK-$STAMP" "$ADMIN"; check "search karyawan" 1 "$(body .data.meta.total)"

echo "▶ Optimistic locking"
call PATCH "/employees/$EMP_ID" "$ADMIN" '{"fullName":"Smoke Test Edit","version":99}'; check "versi basi → 409" 409 "$CODE"
call PATCH "/employees/$EMP_ID" "$ADMIN" '{"fullName":"Smoke Test Edit","version":1}'; check "update versi benar → 200" 200 "$CODE"
check "version naik jadi 2" 2 "$(body .data.version)"

echo "▶ Login pertama wajib ganti password"
call POST /auth/login "" "{\"email\":\"smoke$STAMP@hris.local\",\"password\":\"$TEMP_PW\"}"; check "login password sementara" 200 "$CODE"
EMP=$(body .data.accessToken)
call GET /attendance/today "$EMP"; check "akses ditolak sebelum ganti password" PASSWORD_CHANGE_REQUIRED "$(body .message)"
call POST /auth/change-password "$EMP" "{\"currentPassword\":\"$TEMP_PW\",\"newPassword\":\"lemah\"}"; check "password lemah → 400" 400 "$CODE"
call POST /auth/change-password "$EMP" "{\"currentPassword\":\"$TEMP_PW\",\"newPassword\":\"Rahasia@2026\"}"; check "ganti password" 200 "$CODE"
EMP=$(body .data.accessToken); EMP_REFRESH=$(body .data.refreshToken)
call GET /employees "$EMP"; check "karyawan akses data master → 403" 403 "$CODE"

echo "▶ Absensi: validasi foto & metadata"
call GET /attendance/today "$EMP"; check "boleh check-in" true "$(body .data.canCheckIn)"
upload /attendance/check-in "$EMP" "$TMP/fake.jpg" "${capture_ok[@]}"; check "file palsu (.jpg berisi teks) → 400" 400 "$CODE"
upload /attendance/check-in "$EMP" "$TMP/tiny.jpg" "${capture_ok[@]}"; check "resolusi terlalu kecil → 400" 400 "$CODE"
upload /attendance/check-in "$EMP" "$TMP/photo1.jpg" -F faceCount=2 -F faceConfidence=0.9 -F livenessPassed=true; check "2 wajah → 400" 400 "$CODE"
upload /attendance/check-in "$EMP" "$TMP/photo1.jpg" -F faceCount=1 -F faceConfidence=0.9 -F livenessPassed=false; check "tanpa liveness → 400" 400 "$CODE"
upload /attendance/check-in "$EMP" "$TMP/photo1.jpg" -F faceCount=1 -F faceConfidence=0.9 -F livenessPassed=true -F latitude=-6.2; check "latitude tanpa longitude → 400" 400 "$CODE"
upload /attendance/check-in "$EMP" "$TMP/photo1.jpg" "${capture_ok[@]}" -F employeeId=e0000000-0000-4000-8000-000000000002; check "field employeeId disisipkan → 400" 400 "$CODE"

echo "▶ Absensi: alur check-in / check-out"
upload /attendance/check-in "$EMP" "$TMP/photo1.jpg" "${capture_ok[@]}"; check "check-in → 201" 201 "$CODE"
ATT_ID=$(body .data.id)
check "status dihitung server" true "$(body '.data.status == "PRESENT" or .data.status == "LATE"')"
upload /attendance/check-in "$EMP" "$TMP/photo2.jpg" "${capture_ok[@]}"; check "check-in kedua → 409" 409 "$CODE"
upload /attendance/check-out "$EMP" "$TMP/photo1.jpg" "${capture_ok[@]}"; check "foto dipakai ulang → 409" "Foto ini sudah pernah digunakan" "$(body .message)"
upload /attendance/check-out "$EMP" "$TMP/photo2.jpg" "${capture_ok[@]}"; check "check-out → 201" 201 "$CODE"
check "workMinutes terisi" true "$(body '.data.workMinutes != null')"
upload /attendance/check-out "$EMP" "$TMP/photo3.jpg" "${capture_ok[@]}"; check "check-out kedua → 409" 409 "$CODE"
call GET /attendance/me "$EMP"; check "riwayat milik sendiri" 1 "$(body .data.meta.total)"

echo "▶ Monitoring HR (view-only)"
call GET /attendance "$ADMIN"; check "list absensi hari ini" true "$(body '.data.meta.total >= 1')"
call GET /attendance/summary "$ADMIN"; check "summary" true "$(body '.data.checkedIn >= 1')"
call GET "/attendance/stats?days=7" "$ADMIN"; check "stats 7 hari" 7 "$(body '.data.days | length')"
call GET /attendance/absentees "$ADMIN"; check "event employee.created → karyawan B ada di daftar belum absen" true "$(body "[.data[].employeeId] | index(\"$EMP_B_ID\") != null")"
call GET "/attendance/$ATT_ID" "$ADMIN"; check "detail berisi 2 log" 2 "$(body '.data.logs | length')"
PHOTO_URL=$(body '.data.logs[0].photoUrl')
check "foto via signed URL" "200 image/jpeg" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$PHOTO_URL")"
check "signature diubah → 403" 403 "$(curl -s -o /dev/null -w '%{http_code}' "${PHOTO_URL%?}0")"
call PATCH "/attendance/$ATT_ID" "$ADMIN" '{"status":"PRESENT"}'; check "HR tidak bisa mengubah absensi → 404" 404 "$CODE"
call GET "/attendance?from=2026-01-10&to=2025-01-01" "$ADMIN"; check "rentang tanggal terbalik → 400" 400 "$CODE"
call GET "/attendance?from=$(date -v-10d +%Y-%m-%d 2>/dev/null || date -d '-10 days' +%Y-%m-%d)" "$ADMIN"
OTHER_ATT=$(body "[.data.items[] | select(.employeeId != \"$EMP_ID\")][0].id")
call GET "/attendance/$OTHER_ATT" "$EMP"; check "karyawan lihat absensi orang lain → 404" 404 "$CODE"

echo "▶ Refresh token rotation & reuse detection"
call POST /auth/refresh "" "{\"refreshToken\":\"$EMP_REFRESH\"}"; check "refresh" 200 "$CODE"
NEW_REFRESH=$(body .data.refreshToken)
call POST /auth/refresh "" "{\"refreshToken\":\"$EMP_REFRESH\"}"; check "refresh token lama dipakai ulang → 401" 401 "$CODE"
call POST /auth/refresh "" "{\"refreshToken\":\"$NEW_REFRESH\"}"; check "semua sesi dicabut setelah reuse" 401 "$CODE"

echo "▶ Lockout login"
for i in 1 2 3 4; do call POST /auth/login "" "{\"email\":\"smokeb$STAMP@hris.local\",\"password\":\"Salah@123\"}"; done
check "password salah → 401" 401 "$CODE"
call POST /auth/login "" "{\"email\":\"smokeb$STAMP@hris.local\",\"password\":\"Salah@123\"}"; check "percobaan ke-5 → 423 terkunci" 423 "$CODE"
call POST /auth/login "" "{\"email\":\"smokeb$STAMP@hris.local\",\"password\":\"$TEMP_PW_B\"}"; check "password benar tetap terkunci" 423 "$CODE"

echo "▶ Nonaktifkan karyawan (event employee.status_changed → auth-service)"
call PATCH "/employees/$EMP_ID/status" "$ADMIN" '{"isActive":false,"reason":"smoke test"}'; check "nonaktifkan" false "$(body .data.isActive)"
call PATCH "/employees/$EMP_B_ID/status" "$ADMIN" '{"isActive":false}'
sleep 1.5
call POST /auth/login "" "{\"email\":\"smoke$STAMP@hris.local\",\"password\":\"Rahasia@2026\"}"; check "login akun nonaktif → 403" 403 "$CODE"
call GET /attendance/absentees "$ADMIN"; check "replika attendance-service ikut nonaktif" false "$(body "[.data[].employeeId] | index(\"$EMP_B_ID\") != null")"

echo
echo "Hasil: $PASS lulus, $FAIL gagal"
[[ $FAIL -eq 0 ]]
