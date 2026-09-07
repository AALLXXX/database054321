import { logAudit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { apiKeyGuard } from "@/lib/guard";
import { handler, json, readJson } from "@/lib/http";
import { canAccessBot, deleteBot, toPublicBot, updateBot } from "@/lib/services/bots";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** id bisa berupa id internal, botNumericId (angka sebelum ':'), atau telegramId */
async function resolveBot(user: User, id: string) {
  const store = await getStore();
  const bots = await store.bots.find(
    (b) => canAccessBot(user, b) && (b.id === id || b.botNumericId === id || b.telegramId === id),
  );
  const bot = bots.find((b) => b.id === id) ?? bots[0];
  if (!bot) throw notFound("Bot tidak ditemukan");
  return bot;
}

export const GET = handler(async (req: Request, { params }: Params) => {
  const { user } = await apiKeyGuard(req, "read");
  const { id } = await params;
  return json(toPublicBot(await resolveBot(user, id)));
});

export const PATCH = handler(async (req: Request, { params }: Params) => {
  const { user, key, ip } = await apiKeyGuard(req, "write");
  const { id } = await params;
  const bot = await resolveBot(user, id);
  const body = await readJson(req);
  const updated = await updateBot(user, bot.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
    status: body.status === "active" || body.status === "inactive" ? body.status : undefined,
    telegramId: typeof body.telegramId === "string" ? body.telegramId : undefined,
    token: typeof body.token === "string" && body.token ? body.token : undefined,
  });
  await logAudit(user, "api.bot_update", updated.id, ip, { key: key.prefix });
  return json(toPublicBot(updated));
});

export const DELETE = handler(async (req: Request, { params }: Params) => {
  const { user, key, ip } = await apiKeyGuard(req, "write");
  const { id } = await params;
  const bot = await resolveBot(user, id);
  await deleteBot(user, bot.id);
  await logAudit(user, "api.bot_delete", bot.id, ip, { key: key.prefix });
  return json({ deleted: true });
});
