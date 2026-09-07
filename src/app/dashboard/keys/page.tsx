"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errMsg } from "@/components/api-client";
import { PageHeader } from "@/components/page-header";
import { CopyButton, Empty, Field, Modal, useFmt, useToast } from "@/components/ui";
import { useRealtime } from "@/components/use-realtime";
import type { ApiScope, PublicApiKey } from "@/lib/types";

export default function KeysPage() {
  const toast = useToast();
  const fmt = useFmt();
  const [keys, setKeys] = useState<PublicApiKey[]>([]);
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(["read", "write"]);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => setKeys(await api<PublicApiKey[]>("/api/keys")), []);
  useEffect(() => {
    load().catch((e) => toast("err", errMsg(e)));
    setOrigin(location.origin);
  }, [load, toast]);
  const { status } = useRealtime((e) => {
    if (e.type.startsWith("apikey.")) load().catch(() => {});
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ secret: string }>("/api/keys", { method: "POST", json: { name, scopes } });
      setSecret(r.secret);
      setName("");
      load();
    } catch (err) {
      toast("err", errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k: PublicApiKey) {
    if (!confirm(`Cabut API key "${k.name}"? Script yang memakainya akan berhenti bekerja.`)) return;
    try {
      await api(`/api/keys/${k.id}`, { method: "DELETE" });
      toast("ok", "API key dicabut");
      load();
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  const toggleScope = (s: ApiScope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <div className="fade-in">
      <PageHeader
        title="API Keys"
        subtitle="Pakai API key ini agar script lain (bot, panel, cron) bisa membaca/menulis database kamu."
        live={status}
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + Buat API Key
          </button>
        }
      />

      <div className="glass rounded-2xl">
        <div className="overflow-x-auto">
          {keys.length === 0 ? (
            <Empty title="Belum ada API key" hint="Buat API key lalu pakai di header Authorization: Bearer adb_…" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Prefix</th>
                  <th>Scope</th>
                  <th>Dipakai Terakhir</th>
                  <th>Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className={k.revoked ? "opacity-50" : ""}>
                    <td className="font-medium">{k.name}</td>
                    <td className="mono text-xs text-slate-400">{k.prefix}…</td>
                    <td>
                      <div className="flex gap-1">
                        {k.scopes.map((s) => (
                          <span key={s} className="badge border-violet-400/30 bg-violet-400/10 text-violet-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-xs text-slate-400">{fmt.rel(k.lastUsedAt)}</td>
                    <td className="text-xs text-slate-400">{fmt.date(k.createdAt)}</td>
                    <td className="text-right">
                      {k.revoked ? (
                        <span className="text-xs text-rose-300">Dicabut</span>
                      ) : (
                        <button className="btn btn-danger btn-sm" onClick={() => revoke(k)}>
                          Cabut
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="glass mt-4 rounded-2xl p-5">
        <h2 className="font-semibold">Contoh cepat</h2>
        <pre className="mono mt-3 overflow-x-auto rounded-xl bg-black/40 p-4 text-xs text-slate-300">
{`# Ambil semua bot aktif + token asli
curl -H "Authorization: Bearer adb_XXXX" \\
  "${origin}/api/v1/bots?status=active&reveal=1"

# Tambah bot dari script
curl -X POST -H "Authorization: Bearer adb_XXXX" -H "Content-Type: application/json" \\
  -d '{"token":"8873445464:AAH...","telegramId":"2098147421","name":"Bot 1"}' \\
  ${origin}/api/v1/bots`}
        </pre>
        <p className="mt-2 text-xs text-slate-500">Dokumentasi lengkap ada di menu “API Docs”.</p>
      </div>

      <Modal
        open={open}
        title={secret ? "API Key Dibuat" : "Buat API Key"}
        onClose={() => {
          setOpen(false);
          setSecret(null);
        }}
      >
        {secret ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Simpan key ini sekarang. Demi keamanan, key <b>tidak bisa ditampilkan lagi</b> setelah jendela ini ditutup.
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-black/40 p-3">
              <code className="mono flex-1 break-all text-sm text-cyan-200">{secret}</code>
              <CopyButton text={secret} />
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={() => {
                setOpen(false);
                setSecret(null);
              }}
            >
              Sudah saya simpan
            </button>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-4">
            <Field label="Nama key" hint="Contoh: script-bot-utama">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="script-bot-utama" required />
            </Field>
            <Field label="Scope">
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={scopes.includes("read")} onChange={() => toggleScope("read")} /> read (baca daftar bot)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={scopes.includes("write")} onChange={() => toggleScope("write")} /> write (tambah/edit/hapus/reveal token)
                </label>
              </div>
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Batal
              </button>
              <button className="btn btn-primary" disabled={busy || scopes.length === 0}>
                {busy ? "Membuat…" : "Buat"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
