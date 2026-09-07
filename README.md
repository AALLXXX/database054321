# Alex Database

Database & panel manajemen **token bot Telegram + ID Telegram** yang aman, realtime, full‑stack (Next.js 15 + Postgres), siap deploy ke **Vercel** di `https://alex-database.vercel.app`, dan bisa disambungkan ke script lain lewat **REST API + API Key**.

| Fitur | Keterangan |
|---|---|
| Login | Username + password, hash **scrypt**, lockout otomatis setelah 5x gagal, rate‑limit per IP |
| Role | **Free** (limit 1 bot) → **Reseller** (25 bot, bisa buat user Free) → **Team** (200 bot, buat Free/Reseller, lihat audit) → **Owner** (unlimited, full akses, create/edit/hapus user semua role) |
| Data bot | Token dienkripsi **AES‑256‑GCM** di database, hanya ditampilkan masked; reveal dicatat di audit |
| Realtime | Server‑Sent Events (SSE) — dashboard & script langsung dapat notifikasi saat bot ditambah/diubah/dihapus |
| API | `/api/v1/*` dengan API Key (`adb_…`), scope `read` / `write`, rate‑limit per key |
| Anti‑crack | HttpOnly+Secure cookie ber‑HMAC, CSRF (cek Origin), security headers + CSP, API key disimpan sebagai hash, audit log lengkap |
| UI | Dark glass UI baru, responsif (HP & desktop) |

---

## 1. Struktur Project

```
src/
  app/
    login/                 halaman login + setup Owner pertama
    dashboard/             Overview, Bot Telegram, Users, API Keys, Audit Log, API Docs, Pengaturan
    api/auth/*             login/logout/setup/ganti password
    api/bots, users, keys  API internal (pakai cookie sesi)
    api/v1/*               API publik untuk script lain (pakai API key)
    api/stream             SSE realtime (dashboard)
  lib/
    crypto.ts              scrypt, AES-256-GCM, HMAC
    session.ts             cookie sesi bertanda tangan
    roles.ts               definisi role & limit
    db/                    Postgres (produksi) / file JSON (dev lokal)
    services/              users, bots, apikeys
  middleware.ts            security headers, CSP, redirect ke /login
examples/                  contoh script Node.js & Python
scripts/smoke.sh           tes API otomatis
```

---

## 2. Jalankan di Lokal

```bash
git clone <repo-ini> alex-database && cd alex-database
npm install
cp .env.example .env.local
# Untuk lokal tanpa Postgres, cukup isi SESSION_SECRET & ENCRYPTION_KEY (DATABASE_URL boleh kosong -> data disimpan di .data/)
npm run dev
```

Buka `http://localhost:3000` → akan muncul **Setup Owner Pertama** (buat username & password Owner) → login → dashboard.

> Kalau ingin pakai Postgres lokal via Docker:
> `docker run -d --name alexpg -e POSTGRES_PASSWORD=alex -e POSTGRES_DB=alexdb -p 5432:5432 postgres:16-alpine`
> lalu `DATABASE_URL=postgres://postgres:alex@localhost:5432/alexdb`

---

## 3. Deploy ke Vercel (langkah demi langkah)

### 3.1 Siapkan database Postgres (gratis)
Pilih salah satu: **Neon** (neon.tech), **Supabase**, atau **Vercel Postgres/Marketplace**.
1. Buat project baru → salin **connection string** (format `postgres://user:pass@host/db?sslmode=require`).
2. Tidak perlu membuat tabel manual — aplikasi membuat tabel otomatis saat pertama jalan.

### 3.2 Buat secret
Jalankan dua kali di terminal (atau pakai generator password panjang):
```bash
openssl rand -base64 48   # -> SESSION_SECRET
openssl rand -base64 48   # -> ENCRYPTION_KEY
```
> **PENTING:** `ENCRYPTION_KEY` jangan pernah diganti setelah ada data — token yang tersimpan tidak bisa didekripsi lagi.

### 3.3 Push ke GitHub lalu import ke Vercel
1. Push repo ini ke GitHub.
2. Buka [vercel.com/new](https://vercel.com/new) → **Import** repo → Framework otomatis terdeteksi **Next.js**.
3. Di **Environment Variables**, isi:

| Nama | Nilai |
|---|---|
| `DATABASE_URL` | connection string Postgres dari langkah 3.1 |
| `SESSION_SECRET` | hasil `openssl rand` pertama |
| `ENCRYPTION_KEY` | hasil `openssl rand` kedua |
| `OWNER_USERNAME` | username Owner kamu (opsional) |
| `OWNER_PASSWORD` | password Owner kamu (opsional, min 8 karakter) |
| `APP_URL` | `https://alex-database.vercel.app` |

4. Klik **Deploy**.
5. Di **Settings → Domains**, pastikan domain `alex-database.vercel.app` dipakai (rename project ke `alex-database` bila perlu).

### 3.4 Login pertama
- Kalau `OWNER_USERNAME`/`OWNER_PASSWORD` diisi → langsung login dengan itu (akun Owner dibuat otomatis).
- Kalau dikosongkan → halaman login menampilkan form **Setup Owner Pertama** (hanya muncul selama DB masih kosong).

### 3.5 Update
Setiap `git push` ke branch utama → Vercel deploy ulang otomatis.

---

## 4. Cara Pakai Dashboard

1. **Bot Telegram → + Tambah Bot**: masukkan token dari @BotFather (`123456789:AAH…`) dan ID Telegram (angka chat/user ID). Centang *Verifikasi ke Telegram* agar token dicek via `getMe`.
2. Token tampil **masked**. Klik **Reveal** untuk melihat 20 detik (tercatat di Audit Log).
3. **Users** (Reseller/Team/Owner): buat user dengan role sesuai hak kamu. Owner bisa set limit bot khusus per user, nonaktifkan akun, buka lockout, atau hapus.
4. **API Keys**: buat key untuk script. Key hanya ditampilkan **sekali**.
5. **Audit Log**: semua aktivitas (login, gagal login, tambah/hapus bot, reveal token, perubahan user).
6. **Pengaturan**: ganti password (semua sesi lain otomatis logout).

### Tabel Role & Limit

| Role | Limit bot | Limit API key | Bisa buat user | Hapus user | Lihat audit semua |
|---|---|---|---|---|---|
| Free | 1 | 1 | – | – | – |
| Reseller | 25 | 3 | Free | – | – |
| Team | 200 | 10 | Free, Reseller | ✓ | ✓ |
| Owner | ∞ | ∞ | semua role | ✓ | ✓ |

Limit bisa diubah di `src/lib/roles.ts`. Owner juga dapat memberi *limit khusus* per user dari menu Users.

---

## 5. Menyambungkan Script Lain (API)

**Base URL:** `https://alex-database.vercel.app`
**Header:** `Authorization: Bearer adb_XXXX` (atau `x-api-key: adb_XXXX`)

| Method | Endpoint | Scope | Fungsi |
|---|---|---|---|
| GET | `/api/v1/ping` | – | cek server |
| GET | `/api/v1/me` | read | info akun pemilik key |
| GET | `/api/v1/bots` | read | daftar bot. Query: `status=active`, `telegramId=…`, `reveal=1` (token asli; butuh write), `all=1` (Owner: semua user) |
| POST | `/api/v1/bots` | write | tambah bot `{ token, telegramId, name?, note?, verify? }` |
| GET | `/api/v1/bots/:id` | read | `:id` = id internal **atau** angka bot **atau** telegramId |
| PATCH | `/api/v1/bots/:id` | write | ubah `{ name, note, status, telegramId, token }` |
| DELETE | `/api/v1/bots/:id` | write | hapus |
| GET | `/api/v1/bots/:id/reveal` | write | token asli 1 bot |
| POST | `/api/v1/bots/:id/verify` | write | cek ke Telegram |
| GET | `/api/v1/stream` | read | SSE realtime (`bot.created`, `bot.updated`, `bot.deleted`) |

Respon selalu `{ "ok": true, "data": … }` atau `{ "ok": false, "error": { "code", "message" } }`.

### Contoh curl
```bash
# ambil token semua bot aktif
curl -H "Authorization: Bearer adb_XXXX" \
  "https://alex-database.vercel.app/api/v1/bots?status=active&reveal=1"

# tambah bot
curl -X POST -H "Authorization: Bearer adb_XXXX" -H "Content-Type: application/json" \
  -d '{"token":"123456789:AAH...","telegramId":"2098147421","name":"Bot Utama"}' \
  https://alex-database.vercel.app/api/v1/bots
```

### Contoh Node.js — jalankan bot dari token di database
```js
const res = await fetch("https://alex-database.vercel.app/api/v1/bots?status=active&reveal=1", {
  headers: { Authorization: "Bearer " + process.env.ALEX_API_KEY },
});
const { data: bots } = await res.json();
for (const b of bots) {
  console.log(b.name, b.token, b.telegramId); // pakai b.token untuk TelegramBot(b.token)
}
```

Contoh lengkap: [`examples/node-client.mjs`](examples/node-client.mjs), [`examples/python_client.py`](examples/python_client.py), dan [`examples/telegram-runner.mjs`](examples/telegram-runner.mjs) (menjalankan semua bot + auto‑reload realtime).

### Kode error
`401 invalid_api_key` · `403 missing_scope` · `403 limit_reached` · `409 duplicate_bot` · `400 telegram_rejected` · `429 rate_limited` · `404 not_found`

---

## 6. Keamanan ("anti‑crack") — apa yang sudah diterapkan

- Password: **scrypt** + salt acak, perbandingan constant‑time.
- Token bot: **AES‑256‑GCM**, kunci dari `ENCRYPTION_KEY`; DB bocor ≠ token bocor.
- API key: hanya hash SHA‑256 yang disimpan; key asli tampil sekali.
- Sesi: cookie `HttpOnly` `SameSite=Lax` `Secure`, payload ditandatangani HMAC‑SHA256, kadaluarsa (`SESSION_TTL_HOURS`), semua sesi bisa dicabut (ganti password / nonaktifkan user).
- Brute‑force: rate limit login per IP + lockout akun `MAX_LOGIN_ATTEMPTS` / `LOCKOUT_MINUTES`; pesan error tidak membedakan user salah vs password salah.
- CSRF: semua request tulis lewat cookie wajib berasal dari origin yang sama.
- Header: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP, `noindex`.
- RBAC ketat di server: user tidak bisa membuat role ≥ role dirinya, Owner terakhir tidak bisa dihapus/diturunkan.
- Audit log setiap aksi sensitif.

**Yang harus kamu lakukan:** pakai password Owner yang kuat, simpan `ENCRYPTION_KEY`/`SESSION_SECRET` hanya di Vercel, jangan commit `.env.local`, dan cabut API key yang sudah tidak dipakai.

---

## 7. Perintah

```bash
npm run dev      # development
npm run build    # build produksi
npm run start    # jalankan hasil build
npm run lint     # eslint
bash scripts/smoke.sh http://localhost:3000   # tes API end-to-end
```
