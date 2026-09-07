import { randomId, randomSecret, sha256 } from "../crypto";
import { getStore } from "../db";
import { badRequest, forbidden, notFound, unauthorized } from "../errors";
import { ROLE_SPEC } from "../roles";
import type { ApiKey, ApiScope, PublicApiKey, User } from "../types";

const KEY_PREFIX = "adb_";

export function toPublicApiKey(k: ApiKey): PublicApiKey {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    revoked: k.revoked,
  };
}

export async function listApiKeys(actor: User): Promise<ApiKey[]> {
  const store = await getStore();
  return store.apiKeys.find((k) => k.ownerId === actor.id);
}

export async function createApiKey(
  actor: User,
  input: { name?: string; scopes?: unknown },
): Promise<{ key: ApiKey; secret: string }> {
  const store = await getStore();
  const active = await store.apiKeys.count((k) => k.ownerId === actor.id && !k.revoked);
  const limit = ROLE_SPEC[actor.role].apiKeyLimit;
  if (active >= limit) throw forbidden(`Limit API key untuk role ${ROLE_SPEC[actor.role].label} tercapai (${limit})`, "limit_reached");

  const scopes = normalizeScopes(input.scopes);
  const secret = `${KEY_PREFIX}${randomSecret(32)}`;
  const key: ApiKey = {
    id: randomId(),
    ownerId: actor.id,
    name: (input.name ?? "").trim().slice(0, 60) || "API Key",
    keyHash: sha256(secret),
    prefix: secret.slice(0, 12),
    scopes,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revoked: false,
  };
  await store.apiKeys.insert(key);
  await store.pushEvent({ type: "apikey.created", ownerId: actor.id, payload: toPublicApiKey(key) as unknown as Record<string, unknown> });
  return { key, secret };
}

function normalizeScopes(v: unknown): ApiScope[] {
  if (!Array.isArray(v) || v.length === 0) return ["read"];
  const out = new Set<ApiScope>();
  for (const s of v) {
    if (s === "read" || s === "write") out.add(s);
    else throw badRequest("Scope hanya boleh 'read' atau 'write'");
  }
  return [...out];
}

export async function revokeApiKey(actor: User, id: string): Promise<void> {
  const store = await getStore();
  const key = await store.apiKeys.get(id);
  if (!key || (key.ownerId !== actor.id && actor.role !== "owner")) throw notFound("API key tidak ditemukan");
  await store.apiKeys.update(id, { revoked: true });
  await store.pushEvent({ type: "apikey.revoked", ownerId: key.ownerId, payload: { id } });
}

export async function authenticateApiKey(header: string | null): Promise<{ user: User; key: ApiKey }> {
  const raw = extractKey(header);
  if (!raw || !raw.startsWith(KEY_PREFIX)) throw unauthorized("API key tidak ada atau salah format", "invalid_api_key");
  const store = await getStore();
  const hash = sha256(raw);
  const key = await store.apiKeys.findOne((k) => k.keyHash === hash);
  if (!key || key.revoked) throw unauthorized("API key tidak valid atau sudah dicabut", "invalid_api_key");
  const user = await store.users.get(key.ownerId);
  if (!user || !user.active) throw unauthorized("Pemilik API key tidak aktif", "inactive");
  const now = new Date().toISOString();
  if (!key.lastUsedAt || Date.now() - new Date(key.lastUsedAt).getTime() > 60_000) {
    await store.apiKeys.update(key.id, { lastUsedAt: now });
  }
  return { user, key: { ...key, lastUsedAt: now } };
}

function extractKey(header: string | null): string | null {
  if (!header) return null;
  const h = header.trim();
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return h;
}

export function requireScope(key: ApiKey, scope: ApiScope) {
  if (!key.scopes.includes(scope)) throw forbidden(`API key tidak punya scope '${scope}'`, "missing_scope");
}
