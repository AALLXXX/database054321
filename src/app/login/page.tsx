"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api, errMsg } from "@/components/api-client";
import { Field } from "@/components/ui";

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-lg font-black text-slate-950 shadow-lg shadow-cyan-500/20">
        A
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight">Alex Database</div>
        <div className="text-xs text-slate-400">Secure Telegram Bot Vault</div>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"loading" | "login" | "setup">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/auth/setup")
      .then((d) => setMode(d.needsSetup ? "setup" : "login"))
      .catch(() => setMode("login"));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "setup" && password !== confirm) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setBusy(true);
    try {
      await api(mode === "setup" ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        json: { username, password },
      });
      const next = params.get("next");
      router.replace(next && next.startsWith("/dashboard") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass fade-in w-full max-w-md rounded-3xl p-8">
      <Logo />
      <div className="mt-8">
        <h1 className="text-2xl font-bold">{mode === "setup" ? "Setup Owner Pertama" : "Masuk ke Dashboard"}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === "setup"
            ? "Database masih kosong. Buat akun Owner (akses penuh) untuk memulai."
            : "Verifikasi username & password untuk mengakses database."}
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Username">
          <input
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            required
            disabled={mode === "loading"}
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            autoComplete={mode === "setup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={mode === "setup" ? 8 : undefined}
            disabled={mode === "loading"}
          />
        </Field>
        {mode === "setup" && (
          <Field label="Konfirmasi Password" hint="Minimal 8 karakter. Simpan baik-baik — ini akun dengan akses penuh.">
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
        )}
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <button className="btn btn-primary w-full" disabled={busy || mode === "loading"}>
          {busy ? "Memproses..." : mode === "setup" ? "Buat Owner & Masuk" : "Masuk"}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
        <span>Sesi terenkripsi • Brute-force lockout aktif</span>
        <span className="mono">v1.0</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
