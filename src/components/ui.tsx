"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ROLE_SPEC, type Role } from "@/lib/roles";

/* ---------- Toast ---------- */
interface Toast {
  id: number;
  kind: "ok" | "err" | "info";
  text: string;
}
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`fade-in glass rounded-xl px-4 py-3 text-sm shadow-lg ${
              t.kind === "ok" ? "border-emerald-500/40 text-emerald-200" : t.kind === "err" ? "border-rose-500/40 text-rose-200" : "text-slate-200"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Modal ---------- */
export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`glass fade-in w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl p-6`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Tutup">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Badges ---------- */
export function RoleBadge({ role }: { role: Role }) {
  const spec = ROLE_SPEC[role];
  return (
    <span className="badge" style={{ color: spec.color, borderColor: `${spec.color}55`, background: `${spec.color}14` }}>
      {spec.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: "active" | "inactive" | boolean }) {
  const active = status === true || status === "active";
  return (
    <span
      className="badge"
      style={{
        color: active ? "#6ee7b7" : "#94a3b8",
        borderColor: active ? "rgba(52,211,153,.4)" : "rgba(148,163,184,.3)",
        background: active ? "rgba(52,211,153,.1)" : "rgba(148,163,184,.08)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "#34d399" : "#64748b" }} />
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

/* ---------- Misc ---------- */
export function StatCard({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-bold" style={{ color: accent ?? "#f1f5f9" }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-14 text-center">
      <div className="text-slate-300">{title}</div>
      {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard tidak tersedia */
        }
      }}
    >
      {done ? "Tersalin ✓" : label}
    </button>
  );
}

export function useFmt() {
  return useMemo(
    () => ({
      date: (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"),
      rel: (iso: string | null | undefined) => {
        if (!iso) return "—";
        const d = (Date.now() - new Date(iso).getTime()) / 1000;
        if (d < 60) return "baru saja";
        if (d < 3600) return `${Math.floor(d / 60)} mnt lalu`;
        if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
        return `${Math.floor(d / 86400)} hari lalu`;
      },
    }),
    [],
  );
}
