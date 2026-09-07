import { authenticateApiKey, requireScope } from "./services/apikeys";
import { assertSameOrigin, clientIp } from "./http";
import { env } from "./env";
import { rateLimit } from "./ratelimit";
import { requireUser } from "./session";
import type { ApiKey, ApiScope, User } from "./types";

export interface SessionCtx {
  user: User;
  ip: string;
}

/** Guard untuk route internal dashboard (cookie session) */
export async function sessionGuard(req: Request): Promise<SessionCtx> {
  if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
  const user = await requireUser();
  return { user, ip: clientIp(req) };
}

export interface ApiCtx extends SessionCtx {
  key: ApiKey;
}

/** Guard untuk API publik v1 (header Authorization: Bearer adb_xxx atau x-api-key) */
export async function apiKeyGuard(req: Request, scope: ApiScope): Promise<ApiCtx> {
  const ip = clientIp(req);
  rateLimit(`api-ip:${ip}`, env.apiRateLimitPerMinute, 60_000);
  const header = req.headers.get("authorization") ?? req.headers.get("x-api-key");
  const { user, key } = await authenticateApiKey(header);
  rateLimit(`api-key:${key.id}`, env.apiRateLimitPerMinute, 60_000);
  requireScope(key, scope);
  return { user, key, ip };
}
