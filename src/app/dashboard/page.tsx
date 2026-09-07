"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/api-client";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatusBadge, useFmt } from "@/components/ui";
import { useRealtime } from "@/components/use-realtime";
import { ROLE_SPEC, limitLabel } from "@/lib/roles";
import type { PublicBot, RealtimeEvent } from "@/lib/types";
import { useMe } from "./shell";

interface Stats {
  store: string;
  me: { bots: number; activeBots: number; botLimit: number | null; apiKeys: number; apiKeyLimit: number | null; createdUsers: number };
  global: { users: number; activeUsers: number; bots: number; activeBots: number; apiKeys: number; audit: number } | null;
}

export default function OverviewPage() {
  const me = useMe();
  const fmt = useFmt();
  const [stats, setStats] = useState<Stats | null>(null);
  const [bots, setBots] = useState<PublicBot[]>([]);
  const [feed, setFeed] = useState<RealtimeEvent[]>([]);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([api<Stats>("/api/stats"), api<PublicBot[]>(`/api/bots${me.manageAll ? "?all=1" : ""}`)]);
    setStats(s);
    setBots(b.slice(-6).reverse());
  }, [me.manageAll]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const { status } = useRealtime((e) => {
    setFeed((f) => [e, ...f].slice(0, 12));
    load().catch(() => {});
  });

  const spec = ROLE_SPEC[me.role];
  const limit = stats?.me.botLimit;
  const pct = stats && limit ? Math.min(100, Math.round((stats.me.bots / limit) * 100)) : 0;

  return (
    <div className="fade-in">
      <PageHeader
        title={`Halo, ${me.username}`}
        subtitle={`${spec.label} — ${spec.description}`}
        live={status}
        actions={
          <Link href="/dashboard/bots?add=1" className="btn btn-primary">
            + Tambah Bot
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bot Saya" value={stats?.me.bots ?? "…"} hint={`Limit ${limitLabel(limit ?? Infinity)}`} accent="#67e8f9" />
        <StatCard label="Bot Aktif" value={stats?.me.activeBots ?? "…"} accent="#6ee7b7" />
        <StatCard label="API Key" value={stats?.me.apiKeys ?? "…"} hint={`Limit ${limitLabel(stats?.me.apiKeyLimit ?? Infinity)}`} accent="#c4b5fd" />
        {stats?.global ? (
          <StatCard label="Total User" value={stats.global.users} hint={`${stats.global.activeUsers} aktif • ${stats.global.bots} bot total`} accent="#fcd34d" />
        ) : (
          <StatCard label="User Dibuat" value={stats?.me.createdUsers ?? "…"} hint={spec.canCreate.length ? "User di bawah kamu" : "Role ini tidak membuat user"} />
        )}
      </div>

      {limit != null && (
        <div className="glass mt-4 rounded-2xl p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Pemakaian kuota bot</span>
            <span className="mono text-slate-400">
              {stats?.me.bots}/{limit}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          {pct >= 100 && (
            <div className="mt-2 text-xs text-amber-300">Kuota penuh. Minta owner/reseller untuk upgrade role kamu.</div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="glass rounded-2xl p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Bot Terbaru</h2>
            <Link href="/dashboard/bots" className="text-xs text-cyan-300 hover:underline">
              Lihat semua →
            </Link>
          </div>
          {bots.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Belum ada bot. Tambahkan token bot Telegram pertama kamu.</div>
          ) : (
            <ul className="divide-y divide-line/60">
              {bots.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.name}</div>
                    <div className="mono truncate text-xs text-slate-500">
                      {b.tokenMasked} • ID {b.telegramId}
                      {b.ownerName && me.manageAll ? ` • @${b.ownerName}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Aktivitas Realtime</h2>
          {feed.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Menunggu perubahan… Setiap add/edit/hapus akan muncul di sini tanpa refresh.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {feed.map((e) => (
                <li key={e.seq} className="fade-in flex items-start gap-2 rounded-lg bg-black/20 px-3 py-2">
                  <span className="mono text-[11px] text-cyan-300">{e.type}</span>
                  <span className="truncate text-slate-300">{String((e.payload.name as string) ?? (e.payload.username as string) ?? e.payload.id ?? "")}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-500">{fmt.rel(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {(["free", "reseller", "team", "owner"] as const).map((r) => (
          <div key={r} className={`glass rounded-2xl p-4 ${r === me.role ? "ring-1 ring-cyan-400/40" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold" style={{ color: ROLE_SPEC[r].color }}>
                {ROLE_SPEC[r].label}
              </span>
              <span className="mono text-xs text-slate-400">limit {limitLabel(ROLE_SPEC[r].botLimit)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{ROLE_SPEC[r].description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
