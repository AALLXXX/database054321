"use client";

import type { ReactNode } from "react";
import type { RealtimeStatus } from "./use-realtime";

export function PageHeader({
  title,
  subtitle,
  actions,
  live,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  live?: RealtimeStatus;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {live && <LiveIndicator status={live} />}
        {actions}
      </div>
    </div>
  );
}

export function LiveIndicator({ status }: { status: RealtimeStatus }) {
  return (
    <span className="badge border-line bg-black/20 text-slate-300">
      {status === "live" ? <span className="pulse-dot" /> : <span className="h-2 w-2 rounded-full bg-amber-400" />}
      {status === "live" ? "REALTIME" : status === "connecting" ? "MENYAMBUNG..." : "OFFLINE"}
    </span>
  );
}
