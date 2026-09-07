import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertSameOrigin, clientIp, handler, json, readJson, str } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { authenticate, ensureBootstrapOwner, toPublicUser } from "@/lib/services/users";

export const runtime = "nodejs";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  rateLimit(`login:${ip}`, 20, 10 * 60_000);
  const body = await readJson(req);
  const username = str(body.username, 32);
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) throw new AppError(400, "Username dan password wajib diisi");

  await ensureBootstrapOwner();

  try {
    const user = await authenticate(username, password);
    const res = json(await toPublicUser(user));
    res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions(env.sessionTtlHours * 3600));
    await logAudit(user, "auth.login", user.username, ip);
    return res;
  } catch (e) {
    await logAudit(null, "auth.login_failed", username, ip, { reason: e instanceof AppError ? e.code : "error" });
    if (e instanceof AppError) {
      return NextResponse.json({ ok: false, error: { code: e.code, message: e.message } }, { status: e.status });
    }
    throw e;
  }
});
