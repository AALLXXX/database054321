import { logAudit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { sessionGuard } from "@/lib/guard";
import { handler, json, readJson, str } from "@/lib/http";
import { createBot, listBots, toPublicBot } from "@/lib/services/bots";

export const runtime = "nodejs";

export const GET = handler(async (req: Request) => {
  const { user } = await sessionGuard(req);
  const all = new URL(req.url).searchParams.get("all") === "1";
  const bots = await listBots(user, { all });
  const store = await getStore();
  const users = all ? await store.users.all() : [];
  const nameOf = new Map(users.map((u) => [u.id, u.username]));
  return json(bots.map((b) => toPublicBot(b, nameOf.get(b.ownerId) ?? (b.ownerId === user.id ? user.username : undefined))));
});

export const POST = handler(async (req: Request) => {
  const { user, ip } = await sessionGuard(req);
  const body = await readJson(req);
  const bot = await createBot(user, {
    token: str(body.token, 100),
    telegramId: str(body.telegramId, 32),
    name: str(body.name, 60),
    note: str(body.note, 200),
    status: body.status === "inactive" ? "inactive" : "active",
    verify: Boolean(body.verify),
  });
  await logAudit(user, "bot.create", bot.id, ip, { name: bot.name, botNumericId: bot.botNumericId });
  return json(toPublicBot(bot, user.username), { status: 201 });
});
