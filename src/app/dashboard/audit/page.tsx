"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errMsg } from "@/components/api-client";
import { PageHeader } from "@/components/page-header";
import { Empty, useFmt, useToast } from "@/components/ui";
import { useRealtime } from "@/components/use-realtime";
import type { AuditEntry } from "@/lib/types";
import { useMe } from "../shell";

export default function AuditPage() {
  const me = useMe();
  const toast = useToast();
  const fmt = useFmt();
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => setRows(await api<AuditEntry[]>("/api/audit?limit=300")), []);
  useEffect(() => {
    load().catch((e) => toast("err", errMsg(e)));
  }, [load, toast]);
  const { status } = useRealtime(() => {
    load().catch(() => {});
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => !s || r.action.includes(s) || r.actorName.toLowerCase().includes(s) || r.target.toLowerCase().includes(s) || r.ip.includes(s));
  }, [rows, q]);

  const color = (a: string) =>
    a.includes("failed") || a.includes("delete") || a.includes("revoke")
      ? "text-rose-300"
      : a.includes("reveal")
        ? "text-amber-300"
        : a.includes("create") || a.includes("login")
          ? "text-emerald-300"
          : "text-cyan-300";

  return (
    <div className="fade-in">
      <PageHeader
        title="Audit Log"
        subtitle={me.viewAudit ? "Seluruh aktivitas sistem (login, add/hapus bot, reveal token, perubahan user)." : "Aktivitas akun kamu."}
        live={status}
      />
      <div className="glass rounded-2xl">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <input className="input max-w-sm" placeholder="Filter aksi / user / IP…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="ml-auto text-xs text-slate-500">{filtered.length} entri</span>
        </div>
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <Empty title="Belum ada aktivitas" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aktor</th>
                  <th>Aksi</th>
                  <th>Target</th>
                  <th>IP</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-slate-400">{fmt.date(r.at)}</td>
                    <td className="font-medium">{r.actorName}</td>
                    <td className={`mono text-xs ${color(r.action)}`}>{r.action}</td>
                    <td className="mono max-w-[200px] truncate text-xs text-slate-300">{r.target}</td>
                    <td className="mono text-xs text-slate-500">{r.ip}</td>
                    <td className="mono max-w-[260px] truncate text-[11px] text-slate-500">{Object.keys(r.meta).length ? JSON.stringify(r.meta) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
