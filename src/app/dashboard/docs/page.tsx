"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";

function Code({ children }: { children: string }) {
  return <pre className="mono overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-slate-300">{children}</pre>;
}

function Endpoint({ method, path, desc, scope }: { method: string; path: string; desc: string; scope: string }) {
  const color = method === "GET" ? "text-emerald-300" : method === "DELETE" ? "text-rose-300" : "text-amber-300";
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line/60 py-2.5 text-sm last:border-0">
      <span className={`mono w-16 font-bold ${color}`}>{method}</span>
      <span className="mono text-slate-200">{path}</span>
      <span className="badge border-violet-400/30 bg-violet-400/10 text-violet-200">{scope}</span>
      <span className="text-slate-400">{desc}</span>
    </div>
  );
}

export default function DocsPage() {
  const [origin, setOrigin] = useState("https://alex-database.vercel.app");
  useEffect(() => setOrigin(location.origin), []);

  return (
    <div className="fade-in">
      <PageHeader title="API Docs" subtitle="Cara menyambungkan script lain ke Alex Database." />

      <div className="space-y-4">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">1. Autentikasi</h2>
          <p className="mt-1 text-sm text-slate-400">
            Buat API key di menu <b>API Keys</b>, lalu kirim di header setiap request. Base URL: <code className="mono text-cyan-200">{origin}</code>
          </p>
          <Code>{`Authorization: Bearer adb_XXXXXXXXXXXX
# atau
x-api-key: adb_XXXXXXXXXXXX`}</Code>
          <p className="mt-2 text-xs text-slate-500">
            Semua respon berbentuk <code className="mono">{`{ ok: true, data: ... }`}</code> atau <code className="mono">{`{ ok: false, error: { code, message } }`}</code>.
            Rate limit default 120 request/menit per key.
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">2. Endpoint</h2>
          <div className="mt-2">
            <Endpoint method="GET" path="/api/v1/ping" desc="Cek server hidup (tanpa auth)" scope="-" />
            <Endpoint method="GET" path="/api/v1/me" desc="Info akun & role pemilik key" scope="read" />
            <Endpoint method="GET" path="/api/v1/bots" desc="Daftar bot. Query: status=active|inactive, telegramId=, reveal=1 (token asli, butuh write), all=1 (owner)" scope="read" />
            <Endpoint method="POST" path="/api/v1/bots" desc="Tambah bot { token, telegramId, name?, note?, verify? }" scope="write" />
            <Endpoint method="GET" path="/api/v1/bots/:id" desc=":id = id internal / angka bot / telegramId" scope="read" />
            <Endpoint method="PATCH" path="/api/v1/bots/:id" desc="Ubah { name, note, status, telegramId, token }" scope="write" />
            <Endpoint method="DELETE" path="/api/v1/bots/:id" desc="Hapus bot" scope="write" />
            <Endpoint method="GET" path="/api/v1/bots/:id/reveal" desc="Ambil token asli satu bot (dicatat di audit)" scope="write" />
            <Endpoint method="POST" path="/api/v1/bots/:id/verify" desc="Cek token ke Telegram getMe" scope="write" />
            <Endpoint method="GET" path="/api/v1/stream" desc="Realtime SSE (event bot.created / bot.updated / bot.deleted)" scope="read" />
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">3. Contoh Node.js — ambil token lalu jalankan bot</h2>
          <Code>{`// npm i node-telegram-bot-api
const BASE = "${origin}";
const KEY = process.env.ALEX_API_KEY; // adb_...

async function getBots() {
  const res = await fetch(BASE + "/api/v1/bots?status=active&reveal=1", {
    headers: { Authorization: "Bearer " + KEY },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error.message);
  return json.data; // [{ id, name, token, telegramId, ... }]
}

const TelegramBot = require("node-telegram-bot-api");
(async () => {
  for (const b of await getBots()) {
    const bot = new TelegramBot(b.token, { polling: true });
    bot.on("message", (msg) => {
      if (String(msg.chat.id) !== b.telegramId) return; // hanya owner
      bot.sendMessage(msg.chat.id, "Halo dari " + b.name);
    });
  }
})();`}</Code>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">4. Contoh Python</h2>
          <Code>{`import requests, os
BASE = "${origin}"
H = {"Authorization": f"Bearer {os.environ['ALEX_API_KEY']}"}

# tambah bot
r = requests.post(f"{BASE}/api/v1/bots", headers=H, json={
    "token": "8873445464:AAH...", "telegramId": "2098147421", "name": "Bot 1", "verify": True
})
print(r.json())

# ambil token asli semua bot aktif
bots = requests.get(f"{BASE}/api/v1/bots", headers=H, params={"status": "active", "reveal": "1"}).json()["data"]
for b in bots:
    print(b["name"], b["token"], b["telegramId"])`}</Code>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">5. Realtime (SSE) dari script</h2>
          <Code>{`// Node 18+: pakai eventsource  (npm i eventsource)
const EventSource = require("eventsource");
const es = new EventSource("${origin}/api/v1/stream", {
  headers: { Authorization: "Bearer " + process.env.ALEX_API_KEY },
});
for (const t of ["bot.created", "bot.updated", "bot.deleted"]) {
  es.addEventListener(t, (e) => console.log(t, JSON.parse(e.data).payload));
}
// Koneksi ditutup server tiap ~55 detik; EventSource reconnect otomatis dengan Last-Event-ID.`}</Code>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">6. Kode error</h2>
          <ul className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
            <li><code className="mono text-rose-300">401 invalid_api_key</code> — key salah/dicabut</li>
            <li><code className="mono text-rose-300">403 missing_scope</code> — key tidak punya scope write</li>
            <li><code className="mono text-rose-300">403 limit_reached</code> — kuota bot role tercapai</li>
            <li><code className="mono text-rose-300">409 duplicate_bot</code> — token sudah terdaftar</li>
            <li><code className="mono text-rose-300">400 telegram_rejected</code> — token ditolak Telegram</li>
            <li><code className="mono text-rose-300">429 rate_limited</code> — terlalu banyak request</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
