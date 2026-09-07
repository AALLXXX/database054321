"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errMsg } from "@/components/api-client";
import { PageHeader } from "@/components/page-header";
import { Field, RoleBadge, useToast } from "@/components/ui";
import { ROLE_SPEC, limitLabel } from "@/lib/roles";
import { useMe } from "../shell";

export default function SettingsPage() {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const spec = ROLE_SPEC[me.role];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) return toast("err", "Konfirmasi password tidak sama");
    setBusy(true);
    try {
      await api("/api/auth/password", { method: "POST", json: { currentPassword: cur, newPassword: next } });
      toast("ok", "Password diganti. Silakan login ulang.");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      toast("err", errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader title="Pengaturan" subtitle="Akun & keamanan." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Akun</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Username</dt>
              <dd className="font-medium">{me.username}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Role</dt>
              <dd>
                <RoleBadge role={me.role} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Limit bot</dt>
              <dd className="mono">{limitLabel(spec.botLimit)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Limit API key</dt>
              <dd className="mono">{limitLabel(spec.apiKeyLimit)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Bisa membuat user</dt>
              <dd>{spec.canCreate.length ? spec.canCreate.map((r) => ROLE_SPEC[r].label).join(", ") : "Tidak"}</dd>
            </div>
          </dl>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Ganti Password</h2>
          <p className="mt-1 text-xs text-slate-500">Setelah ganti password, semua sesi login (termasuk di perangkat lain) akan diputus.</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <Field label="Password saat ini">
              <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
            </Field>
            <Field label="Password baru" hint="Minimal 8 karakter">
              <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label="Konfirmasi password baru">
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Menyimpan…" : "Ganti Password"}
            </button>
          </form>
        </div>

        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-semibold">Keamanan yang aktif</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <li>• Password di-hash dengan scrypt (bukan disimpan plaintext)</li>
            <li>• Token bot dienkripsi AES-256-GCM di database</li>
            <li>• API key disimpan sebagai hash SHA-256 (tidak bisa dibaca dari DB)</li>
            <li>• Lockout otomatis setelah beberapa kali gagal login</li>
            <li>• Rate limit per IP & per API key</li>
            <li>• Cookie sesi HttpOnly + SameSite + Secure, ditandatangani HMAC</li>
            <li>• Proteksi CSRF (cek Origin) untuk semua aksi tulis</li>
            <li>• Audit log untuk setiap reveal token, login, & perubahan data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
