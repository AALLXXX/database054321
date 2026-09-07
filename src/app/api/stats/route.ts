import { getStore } from "@/lib/db";
import { sessionGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { ROLE_SPEC } from "@/lib/roles";
import { effectiveBotLimit } from "@/lib/services/users";

export const runtime = "nodejs";

export const GET = handler(async (req: Request) => {
  const { user } = await sessionGuard(req);
  const store = await getStore();
  const spec = ROLE_SPEC[user.role];
  const myBots = await store.bots.find((b) => b.ownerId === user.id);
  const myKeys = await store.apiKeys.count((k) => k.ownerId === user.id && !k.revoked);
  const limit = effectiveBotLimit(user);

  const global = spec.manageAll
    ? {
        users: await store.users.count(),
        activeUsers: await store.users.count((u) => u.active),
        bots: await store.bots.count(),
        activeBots: await store.bots.count((b) => b.status === "active"),
        apiKeys: await store.apiKeys.count((k) => !k.revoked),
        audit: await store.audit.count(),
      }
    : null;

  const createdUsers = spec.canCreate.length ? await store.users.count((u) => u.createdBy === user.id) : 0;

  return json({
    store: store.kind,
    me: {
      bots: myBots.length,
      activeBots: myBots.filter((b) => b.status === "active").length,
      botLimit: Number.isFinite(limit) ? limit : null,
      apiKeys: myKeys,
      apiKeyLimit: Number.isFinite(spec.apiKeyLimit) ? spec.apiKeyLimit : null,
      createdUsers,
    },
    global,
  });
});
