"use client";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json: body, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : rest.body,
  });
  let payload: Envelope<T> | null = null;
  try {
    payload = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError(res.status, "bad_response", `Respon server tidak valid (${res.status})`);
  }
  if (!payload.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
      location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    }
    throw new ApiClientError(res.status, payload.error.code, payload.error.message);
  }
  return payload.data;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Terjadi kesalahan";
}
