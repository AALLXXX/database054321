// Contoh: ambil semua bot aktif dari Alex Database lalu jalankan semuanya sekaligus
// dengan long-polling Telegram (tanpa library tambahan), dan ikuti perubahan realtime.
//
//   ALEX_API_KEY=adb_xxx node examples/telegram-runner.mjs

import { alex } from "./node-client.mjs";

const BASE = process.env.ALEX_BASE_URL || "https://alex-database.vercel.app";
const KEY = process.env.ALEX_API_KEY;
const running = new Map(); // botId -> AbortController

async function runBot(b) {
  if (running.has(b.id)) return;
  const ac = new AbortController();
  running.set(b.id, ac);
  console.log(`[start] ${b.name}`);
  let offset = 0;
  while (!ac.signal.aborted) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${b.token}/getUpdates?timeout=30&offset=${offset}`, { signal: ac.signal });
      const j = await r.json();
      for (const u of j.result ?? []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg) continue;
        if (String(msg.chat.id) !== String(b.telegramId)) continue; // hanya owner bot
        await fetch(`https://api.telegram.org/bot${b.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: msg.chat.id, text: `Halo dari ${b.name}! Kamu bilang: ${msg.text ?? "(non-teks)"}` }),
        });
      }
    } catch (e) {
      if (ac.signal.aborted) break;
      console.error(`[${b.name}]`, e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log(`[stop] ${b.name}`);
}

function stopBot(id) {
  running.get(id)?.abort();
  running.delete(id);
}

async function syncAll() {
  const bots = await alex.bots({ status: "active", reveal: true });
  const ids = new Set(bots.map((b) => b.id));
  for (const id of running.keys()) if (!ids.has(id)) stopBot(id);
  for (const b of bots) runBot(b);
}

// Realtime: dengarkan SSE, resync saat ada perubahan bot.
async function listen() {
  let lastId = "";
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/v1/stream`, {
        headers: { Authorization: `Bearer ${KEY}`, Accept: "text/event-stream", ...(lastId ? { "Last-Event-ID": lastId } : {}) },
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = /^event: (.+)$/m.exec(chunk)?.[1];
          const id = /^id: (.+)$/m.exec(chunk)?.[1];
          if (id) lastId = id;
          if (ev?.startsWith("bot.")) {
            console.log("[realtime]", ev);
            await syncAll();
          }
        }
      }
    } catch (e) {
      console.error("[sse]", e.message);
    }
    await new Promise((r) => setTimeout(r, 1500)); // reconnect
  }
}

await syncAll();
listen();
