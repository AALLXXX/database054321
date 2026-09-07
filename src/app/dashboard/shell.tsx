"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "@/components/api-client";
import { RoleBadge } from "@/components/ui";
import type { Role } from "@/lib/roles";

export interface Me {
  id: string;
  username: string;
  role: Role;
  canManageUsers: boolean;
  viewAudit: boolean;
  manageAll: boolean;
}

const MeCtx = createContext<Me | null>(null);
export const useMe = () => {
  const me = useContext(MeCtx);
  if (!me) throw new Error("useMe di luar Shell");
  return me;
};

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "▦" },
  { href: "/dashboard/bots", label: "Bot Telegram", icon: "🤖" },
  { href: "/dashboard/users", label: "Users", icon: "👥", need: "users" as const },
  { href: "/dashboard/keys", label: "API Keys", icon: "🔑" },
  { href: "/dashboard/audit", label: "Audit Log", icon: "📜" },
  { href: "/dashboard/docs", label: "API Docs", icon: "📘" },
  { href: "/dashboard/settings", label: "Pengaturan", icon: "⚙" },
];

export function Shell({ me, children }: { me: Me; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = NAV.filter((n) => n.need !== "users" || me.canManageUsers);

  const sidebar = (
    <aside className="glass flex h-full w-64 flex-col rounded-2xl p-4">
      <Link href="/dashboard" className="flex items-center gap-3 px-2 py-1">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-base font-black text-slate-950">
          A
        </div>
        <div>
          <div className="font-bold leading-tight">Alex Database</div>
          <div className="text-[11px] text-slate-400">Telegram Bot Vault</div>
        </div>
      </Link>

      <nav className="mt-6 flex-1 space-y-1">
        {nav.map((n) => {
          const active = n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/30" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="w-5 text-center text-base">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-line bg-black/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{me.username}</div>
            <div className="mt-1">
              <RoleBadge role={me.role} />
            </div>
          </div>
          <button onClick={logout} className="btn btn-ghost btn-sm" title="Keluar">
            Keluar
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <MeCtx.Provider value={me}>
      <div className="mx-auto flex min-h-screen max-w-[1400px] gap-4 p-4">
        <div className="hidden lg:block">{sidebar}</div>
        {open && (
          <div className="fixed inset-0 z-40 flex bg-black/60 p-4 lg:hidden" onClick={() => setOpen(false)}>
            <div onClick={(e) => e.stopPropagation()}>{sidebar}</div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <button className="btn btn-ghost" onClick={() => setOpen(true)} aria-label="Menu">
              ☰
            </button>
            <div className="font-bold">Alex Database</div>
          </div>
          {children}
        </div>
      </div>
    </MeCtx.Provider>
  );
}
