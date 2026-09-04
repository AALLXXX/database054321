# ALEX DATABASE SCRIPT

Panel web untuk mengelola akses/lisensi script WhatsApp & Telegram —
role-based (user/ress/partner/admin/moderator/owner), limit per role,
IP-lock anti-share akun, database nomor WA & token Telegram terpisah,
chat internal, tema warna, dan panel Owner full control.

**Baca `tutorial.txt` untuk panduan setup & deploy lengkap.**

## Struktur
- `server.js` — entry point
- `routes/` — auth, dashboard (user), owner, chat
- `models/` — User, WaNumber, TgToken, LoginLog, Notification, Chat
- `views/` — halaman EJS (landing, login, dashboard, owner, chat)
- `public/css/style.css` — tema warna & animasi UI

## Quick start
```
cp .env.example .env   # lalu isi
npm install
npm start
```
Buka `http://localhost:5000`, lalu kunjungi `/setup-owner` sekali untuk
membuat akun owner pertama.
