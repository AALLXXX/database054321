import { randomId } from "./crypto";
import { getStore } from "./db";
import type { AuditEntry, User } from "./types";

export async function logAudit(
  actor: Pick<User, "id" | "username"> | null,
  action: string,
  target: string,
  ip: string,
  meta: Record<string, unknown> = {},
) {
  const store = await getStore();
  const entry: AuditEntry = {
    id: randomId(),
    actorId: actor?.id ?? null,
    actorName: actor?.username ?? "system",
    action,
    target,
    ip,
    at: new Date().toISOString(),
    meta,
  };
  await store.audit.insert(entry);
  const total = await store.audit.count();
  if (total > 5000) {
    const all = await store.audit.all();
    const stale = new Set(all.slice(0, total - 5000).map((a) => a.id));
    await store.audit.removeWhere((a) => stale.has(a.id));
  }
}
