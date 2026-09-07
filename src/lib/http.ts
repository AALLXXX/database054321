import { NextResponse } from "next/server";
import { AppError } from "./errors";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ ok: false, error: { code: "internal", message } }, { status: 500 });
}

export function handler<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return jsonError(err);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = (await req.json()) as T;
    if (!body || typeof body !== "object") throw new Error();
    return body;
  } catch {
    throw new AppError(400, "Body harus berupa JSON yang valid", "invalid_json");
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return;
  try {
    if (new URL(origin).host !== host) {
      throw new AppError(403, "Origin tidak diizinkan", "bad_origin");
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(403, "Origin tidak valid", "bad_origin");
  }
}
