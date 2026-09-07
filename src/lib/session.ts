import { cookies } from "next/headers";
import { hmacSign, safeEqual } from "./crypto";
import { getStore } from "./db";
import { env } from "./env";
import { unauthorized } from "./errors";
import type { User } from "./types";

export const SESSION_COOKIE = "alex_session";

interface SessionPayload {
  uid: string;
  sv: number;
  exp: number;
  iat: number;
}

export function createSessionToken(user: User): string {
  const payload: SessionPayload = {
    uid: user.id,
    sv: user.sessionVersion,
    iat: Date.now(),
    exp: Date.now() + env.sessionTtlHours * 3600 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmacSign(body)}`;
}

export function parseSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(hmacSign(body), sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProd,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const payload = parseSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const store = await getStore();
  const user = await store.users.get(payload.uid);
  if (!user || !user.active || user.sessionVersion !== payload.sv) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}
