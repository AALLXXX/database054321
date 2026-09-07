export const TELEGRAM_TOKEN_RE = /^(\d{6,12}):([A-Za-z0-9_-]{30,50})$/;
export const TELEGRAM_ID_RE = /^-?\d{5,20}$/;

export function parseTelegramToken(token: string): { numericId: string } | null {
  const m = TELEGRAM_TOKEN_RE.exec(token.trim());
  return m ? { numericId: m[1] } : null;
}

export interface TelegramCheck {
  ok: boolean;
  username: string | null;
  firstName: string | null;
  error: string | null;
}

/** Cek token ke Telegram Bot API (getMe). Tidak melempar error — hasil selalu dikembalikan. */
export async function checkTelegramToken(token: string): Promise<TelegramCheck> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username?: string; first_name?: string };
      description?: string;
    };
    if (!data.ok) return { ok: false, username: null, firstName: null, error: data.description ?? "Token ditolak Telegram" };
    return {
      ok: true,
      username: data.result?.username ?? null,
      firstName: data.result?.first_name ?? null,
      error: null,
    };
  } catch (e) {
    return { ok: false, username: null, firstName: null, error: e instanceof Error ? e.message : "Gagal menghubungi Telegram" };
  }
}
