// Contoh client Alex Database untuk Node.js 18+ (tanpa dependency).
// Jalankan:  ALEX_API_KEY=adb_xxx node examples/node-client.mjs
//
// Ganti BASE ke URL deploy kamu, misal https://alex-database.vercel.app

const BASE = process.env.ALEX_BASE_URL || "https://alex-database.vercel.app";
const KEY = process.env.ALEX_API_KEY;
if (!KEY) throw new Error("Set env ALEX_API_KEY (buat di menu API Keys)");

async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${res.status} ${json.error.code}: ${json.error.message}`);
  return json.data;
}

export const alex = {
  me: () => call("/api/v1/me"),
  /** Daftar bot. reveal=true untuk ikut mengambil token asli (butuh scope write). */
  bots: ({ status, telegramId, reveal } = {}) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (telegramId) q.set("telegramId", telegramId);
    if (reveal) q.set("reveal", "1");
    return call(`/api/v1/bots?${q}`);
  },
  bot: (id) => call(`/api/v1/bots/${id}`),
  add: ({ token, telegramId, name, note, verify = true }) =>
    call("/api/v1/bots", { method: "POST", body: JSON.stringify({ token, telegramId, name, note, verify }) }),
  update: (id, patch) => call(`/api/v1/bots/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id) => call(`/api/v1/bots/${id}`, { method: "DELETE" }),
  reveal: (id) => call(`/api/v1/bots/${id}/reveal`),
  verify: (id) => call(`/api/v1/bots/${id}/verify`, { method: "POST" }),
};

// Demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const me = await alex.me();
  console.log("Login sebagai:", me.user.username, `(${me.role})`);

  const bots = await alex.bots({ status: "active", reveal: true });
  console.log(`Ada ${bots.length} bot aktif`);
  for (const b of bots) {
    console.log(`- ${b.name} | token: ${b.token.slice(0, 12)}… | telegramId: ${b.telegramId}`);
    // Di sini kamu bisa langsung memakai b.token untuk menjalankan bot Telegram.
  }
}
