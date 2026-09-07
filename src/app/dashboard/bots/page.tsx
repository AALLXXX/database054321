"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, errMsg } from "@/components/api-client";
import { PageHeader } from "@/components/page-header";
import { CopyButton, Empty, Field, Modal, StatusBadge, useFmt, useToast } from "@/components/ui";
import { useRealtime } from "@/components/use-realtime";
import type { PublicBot } from "@/lib/types";
import { useMe } from "../shell";

function BotsInner() {
  const me = useMe();
  const toast = useToast();
  const fmt = useFmt();
  const router = useRouter();
  const params = useSearchParams();

  const [bots, setBots] = useState<PublicBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"mine" | "all">(me.manageAll ? "all" : "mine");
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [editing, setEditing] = useState<PublicBot | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; token: string } | null>(null);

  const load = useCallback(async () => {
    const data = await api<PublicBot[]>(`/api/bots${scope === "all" ? "?all=1" : ""}`);
    setBots(data.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    load().catch((e) => toast("err", errMsg(e)));
  }, [load, toast]);

  const { status } = useRealtime((e) => {
    if (e.type.startsWith("bot.")) load().catch(() => {});
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return bots;
    return bots.filter(
      (b) =>
        b.name.toLowerCase().includes(s) ||
        b.telegramId.includes(s) ||
        b.botNumericId.includes(s) ||
        (b.botUsername ?? "").toLowerCase().includes(s) ||
        (b.ownerName ?? "").toLowerCase().includes(s),
    );
  }, [bots, q]);

  async function remove(b: PublicBot) {
    if (!confirm(`Hapus bot "${b.name}"? Token akan dihapus permanen.`)) return;
    try {
      await api(`/api/bots/${b.id}`, { method: "DELETE" });
      toast("ok", "Bot dihapus");
      load();
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  async function toggle(b: PublicBot) {
    try {
      await api(`/api/bots/${b.id}`, { method: "PATCH", json: { status: b.status === "active" ? "inactive" : "active" } });
      load();
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  async function verify(b: PublicBot) {
    try {
      const r = await api<{ ok: boolean; error: string | null }>(`/api/bots/${b.id}/verify`, { method: "POST" });
      toast(r.ok ? "ok" : "err", r.ok ? "Token valid di Telegram ✓" : `Token ditolak: ${r.error}`);
      load();
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  async function reveal(b: PublicBot) {
    try {
      const r = await api<{ id: string; token: string }>(`/api/bots/${b.id}/reveal`, { method: "POST" });
      setRevealed(r);
      setTimeout(() => setRevealed((cur) => (cur?.id === r.id ? null : cur)), 30_000);
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Bot Telegram"
        subtitle="Token dienkripsi AES-256-GCM. Token asli hanya tampil saat kamu klik Lihat (dicatat di audit)."
        live={status}
        actions={
          <>
            {me.manageAll && (
              <select className="input w-auto py-2" value={scope} onChange={(e) => setScope(e.target.value as "mine" | "all")}>
                <option value="all">Semua user</option>
                <option value="mine">Bot saya</option>
              </select>
            )}
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              + Tambah Bot
            </button>
          </>
        }
      />

      <div className="glass rounded-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <input className="input max-w-sm" placeholder="Cari nama / ID Telegram / username bot…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="ml-auto text-xs text-slate-500">{filtered.length} bot</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <Empty title="Memuat…" />
          ) : filtered.length === 0 ? (
            <Empty title="Belum ada bot" hint="Klik “+ Tambah Bot” untuk menyimpan token + ID Telegram." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Token</th>
                  <th>ID Telegram</th>
                  {scope === "all" && <th>Pemilik</th>}
                  <th>Status</th>
                  <th>Cek Telegram</th>
                  <th>Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-slate-500">{b.botUsername ? `@${b.botUsername}` : `#${b.botNumericId}`}</div>
                    </td>
                    <td className="mono text-xs">
                      {revealed?.id === b.id ? (
                        <div className="flex items-center gap-2">
                          <span className="select-all text-cyan-200">{revealed.token}</span>
                          <CopyButton text={revealed.token} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{b.tokenMasked}</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => reveal(b)}>
                            Lihat
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="mono">
                      <div className="flex items-center gap-1">
                        {b.telegramId}
                        <CopyButton text={b.telegramId} label="⧉" />
                      </div>
                    </td>
                    {scope === "all" && <td className="text-slate-300">{b.ownerName ?? "—"}</td>}
                    <td>
                      <button onClick={() => toggle(b)} title="Klik untuk ubah status">
                        <StatusBadge status={b.status} />
                      </button>
                    </td>
                    <td className="text-xs">
                      {b.lastCheckOk === null ? (
                        <span className="text-slate-500">Belum dicek</span>
                      ) : b.lastCheckOk ? (
                        <span className="text-emerald-300">Valid • {fmt.rel(b.lastCheckedAt)}</span>
                      ) : (
                        <span className="text-rose-300">Ditolak • {fmt.rel(b.lastCheckedAt)}</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-400">{fmt.date(b.createdAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn btn-ghost btn-sm" onClick={() => verify(b)}>
                          Cek
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(b)}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(b)}>
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <BotForm
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          if (params.get("add")) router.replace("/dashboard/bots");
        }}
        onSaved={() => {
          setAddOpen(false);
          load();
        }}
      />
      <BotForm open={Boolean(editing)} bot={editing ?? undefined} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function BotForm({ open, bot, onClose, onSaved }: { open: boolean; bot?: PublicBot; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [verify, setVerify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setToken("");
    setTelegramId(bot?.telegramId ?? "");
    setName(bot?.name ?? "");
    setNote(bot?.note ?? "");
    setError(null);
  }, [open, bot]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (bot) {
        await api(`/api/bots/${bot.id}`, { method: "PATCH", json: { name, note, telegramId, ...(token ? { token } : {}) } });
        toast("ok", "Bot diperbarui");
      } else {
        await api("/api/bots", { method: "POST", json: { token, telegramId, name, note, verify } });
        toast("ok", "Bot berhasil ditambahkan");
      }
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={bot ? "Edit Bot" : "Tambah Bot Telegram"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={bot ? "Token baru (kosongkan jika tidak diganti)" : "Token Bot"} hint="Format: 123456789:AAH... (dari @BotFather)">
          <input className="input mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="8873445464:AAH…" required={!bot} autoComplete="off" />
        </Field>
        <Field label="ID Telegram" hint="Chat ID / user ID pemilik bot (angka). Contoh: 2098147421">
          <input className="input mono" value={telegramId} onChange={(e) => setTelegramId(e.target.value)} placeholder="2098147421" required inputMode="numeric" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama (opsional)">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bot Toko" maxLength={60} />
          </Field>
          <Field label="Catatan (opsional)">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="untuk script X" maxLength={200} />
          </Field>
        </div>
        {!bot && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
            Verifikasi token ke Telegram (getMe) sebelum disimpan
          </label>
        )}
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Menyimpan…" : bot ? "Simpan" : "Tambah"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function BotsPage() {
  return (
    <Suspense fallback={null}>
      <BotsInner />
    </Suspense>
  );
}
