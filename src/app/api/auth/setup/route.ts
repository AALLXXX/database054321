import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { forbidden } from "@/lib/errors";
import { assertSameOrigin, clientIp, handler, json, readJson, str } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { createUser, ensureBootstrapOwner, needsSetup, toPublicUser } from "@/lib/services/users";

export const runtime = "nodejs";

/** Status setup awal: apakah sudah ada user (Owner) */
export const GET = handler(async () => {
  await ensureBootstrapOwner();
  return json({ needsSetup: await needsSetup(), appName: env.appName });
});

/** Buat Owner pertama. Hanya bisa dipanggil ketika database masih kosong. */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  rateLimit(`setup:${ip}`, 5, 10 * 60_000);
  await ensureBootstrapOwner();
  if (!(await needsSetup())) throw forbidden("Setup sudah dilakukan. Silakan login.");
  const body = await readJson(req);
  const user = await createUser(null, {
    username: str(body.username, 32),
    password: typeof body.password === "string" ? body.password : "",
    role: "owner",
    note: "Owner utama",
  });
  await logAudit(user, "auth.setup_owner", user.username, ip);
  const res = json(await toPublicUser(user));
  res.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions(env.sessionTtlHours * 3600));
  return res;
});
