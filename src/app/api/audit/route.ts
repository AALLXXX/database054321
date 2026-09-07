import { getStore } from "@/lib/db";
import { sessionGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { ROLE_SPEC } from "@/lib/roles";

export const runtime = "nodejs";

export const GET = handler(async (req: Request) => {
  const { user } = await sessionGuard(req);
  const store = await getStore();
  const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit") || 100));
  const all = await store.audit.all();
  const visible = ROLE_SPEC[user.role].viewAudit ? all : all.filter((a) => a.actorId === user.id);
  return json(visible.slice(-limit).reverse());
});
