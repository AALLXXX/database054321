"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, errMsg } from "@/components/api-client";
import { PageHeader } from "@/components/page-header";
import { Empty, Field, Modal, RoleBadge, StatusBadge, useFmt, useToast } from "@/components/ui";
import { useRealtime } from "@/components/use-realtime";
import { ROLE_SPEC, limitLabel, type Role } from "@/lib/roles";
import type { PublicUser } from "@/lib/types";
import { useMe } from "../shell";

export default function UsersPage() {
  const me = useMe();
  const toast = useToast();
  const fmt = useFmt();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);

  const load = useCallback(async () => {
    setUsers(await api<PublicUser[]>("/api/users"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => toast("err", errMsg(e)));
  }, [load, toast]);

  const { status } = useRealtime((e) => {
    if (e.type.startsWith("user.") || e.type.startsWith("bot.")) load().catch(() => {});
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => !s || u.username.toLowerCase().includes(s) || u.role.includes(s));
  }, [users, q]);

  const creatable = ROLE_SPEC[me.role].canCreate;

  async function toggleActive(u: PublicUser) {
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", json: { active: !u.active } });
      toast("ok", u.active ? "User dinonaktifkan" : "User diaktifkan");
      load();
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  async function remove(u: PublicUser) {
    if (!confirm(`Hapus user "${u.username}" beserta semua bot & API key-nya?`)) return;
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      toast("ok", "User dihapus");
      load();
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  async function unlock(u: PublicUser) {
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", json: { resetLock: true } });
      toast("ok", "Kunci login direset");
      load();
    } catch (e) {
      toast("err", errMsg(e));
    }
  }

  const canManage = (u: PublicUser) => u.id !== me.id && (me.role === "owner" || (u.createdBy === me.id && ROLE_SPEC[me.role].canCreate.includes(u.role)));

  return (
    <div className="fade-in">
      <PageHeader
        title="Manajemen User"
        subtitle={`Kamu bisa membuat: ${creatable.map((r) => ROLE_SPEC[r].label).join(", ") || "—"}`}
        live={status}
        actions={
          <button className="btn btn-primary" onClick={() => setAddOpen(true)} disabled={!creatable.length}>
            + Create User
          </button>
        }
      />

      <div className="glass rounded-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <input className="input max-w-sm" placeholder="Cari username / role…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="ml-auto text-xs text-slate-500">{filtered.length} user</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <Empty title="Memuat…" />
          ) : filtered.length === 0 ? (
            <Empty title="Belum ada user" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Bot</th>
                  <th>Status</th>
                  <th>Login Terakhir</th>
                  <th>Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const locked = u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now();
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="font-medium">
                          {u.username} {u.id === me.id && <span className="text-xs text-slate-500">(kamu)</span>}
                        </div>
                        {u.note && <div className="text-xs text-slate-500">{u.note}</div>}
                      </td>
                      <td>
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="mono text-sm">
                        {u.botCount}/{limitLabel(u.botLimit ?? Infinity)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={u.active} />
                          {locked && <span className="badge border-amber-400/40 bg-amber-400/10 text-amber-200">Terkunci</span>}
                        </div>
                      </td>
                      <td className="text-xs text-slate-400">{fmt.date(u.lastLoginAt)}</td>
                      <td className="text-xs text-slate-400">{fmt.date(u.createdAt)}</td>
                      <td>
                        {canManage(u) && (
                          <div className="flex justify-end gap-1">
                            {locked && (
                              <button className="btn btn-ghost btn-sm" onClick={() => unlock(u)}>
                                Buka Kunci
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                              {u.active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>
                              Edit
                            </button>
                            {ROLE_SPEC[me.role].canDeleteUsers && (
                              <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>
                                Hapus
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <UserForm open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} creatable={creatable} isOwner={me.role === "owner"} />
      <UserForm open={Boolean(editing)} user={editing ?? undefined} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} creatable={creatable} isOwner={me.role === "owner"} />
    </div>
  );
}

function UserForm({
  open,
  user,
  onClose,
  onSaved,
  creatable,
  isOwner,
}: {
  open: boolean;
  user?: PublicUser;
  onClose: () => void;
  onSaved: () => void;
  creatable: readonly Role[];
  isOwner: boolean;
}) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(creatable[0] ?? "free");
  const [note, setNote] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsername(user?.username ?? "");
    setPassword("");
    setRole(user?.role ?? creatable[0] ?? "free");
    setNote(user?.note ?? "");
    setLimit(user?.botLimit != null && user.botLimit !== ROLE_SPEC[user.role].botLimit ? String(user.botLimit) : "");
    setError(null);
  }, [open, user, creatable]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const limitVal = limit.trim() === "" ? null : Number(limit);
      if (user) {
        await api(`/api/users/${user.id}`, {
          method: "PATCH",
          json: { role, note, ...(password ? { password } : {}), ...(isOwner ? { botLimitOverride: limitVal } : {}) },
        });
        toast("ok", "User diperbarui");
      } else {
        await api("/api/users", { method: "POST", json: { username, password, role, note, ...(isOwner ? { botLimitOverride: limitVal } : {}) } });
        toast("ok", `User ${username} dibuat`);
      }
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={user ? `Edit ${user.username}` : "Create User"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!user && (
          <Field label="Username" hint="3-32 karakter: huruf, angka, . _ -">
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" />
          </Field>
        )}
        <Field label={user ? "Password baru (kosongkan jika tidak diganti)" : "Password"} hint="Minimal 8 karakter">
          <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required={!user} autoComplete="new-password" />
        </Field>
        <Field label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {creatable.map((r) => (
              <option key={r} value={r}>
                {ROLE_SPEC[r].label} — limit {limitLabel(ROLE_SPEC[r].botLimit)} bot
              </option>
            ))}
          </select>
        </Field>
        {isOwner && (
          <Field label="Limit bot khusus (opsional)" hint="Kosongkan untuk pakai default role">
            <input className="input" type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="default" />
          </Field>
        )}
        <Field label="Catatan (opsional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Menyimpan…" : user ? "Simpan" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
