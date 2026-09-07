import { logAudit } from "@/lib/audit";
import { apiKeyGuard } from "@/lib/guard";
import { handler, json, readJson, str } from "@/lib/http";
import { createBot, listBots, revealToken, toPublicBot } from "@/lib/services/bots";

export const runtime = "nodejs";

/**
 * GET /api/v1/bots?status=active&reveal=1&telegramId=123
 * Header: Authorization: Bearer adb_xxx
 * reveal=1 mengembalikan token asli (butuh scope write, dicatat di audit).
 */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const reveal = url.searchParams.get("reveal") === "1";
  const { user, key, ip } = await apiKeyGuard(req, reveal ? "write" : "read");
  const status = url.searchParams.get("status");
  const telegramId = url.searchParams.get("telegramId");
  const all = url.searchParams.get("all") === "1";

  let bots = await listBots(user, { all });
  if (status === "active" || status === "inactive") bots = bots.filter((b) => b.status === status);
  if (telegramId) bots = bots.filter((b) => b.telegramId === telegramId);

  if (reveal) await logAudit(user, "api.reveal_tokens", `${bots.length} bot`, ip, { key: key.prefix });

  return json(
    bots.map((b) => ({
      ...toPublicBot(b),
      ...(reveal ? { token: revealToken(b) } : {}),
    })),
  );
});

/** POST /api/v1/bots  { token, telegramId, name?, note?, verify? } */
export const POST = handler(async (req: Request) => {
  const { user, key, ip } = await apiKeyGuard(req, "write");
  const body = await readJson(req);
  const bot = await createBot(user, {
    token: str(body.token, 100),
    telegramId: str(body.telegramId ?? body.telegram_id ?? body.id, 32),
    name: str(body.name, 60),
    note: str(body.note, 200),
    status: body.status === "inactive" ? "inactive" : "active",
    verify: Boolean(body.verify),
  });
  await logAudit(user, "api.bot_create", bot.id, ip, { key: key.prefix, name: bot.name });
  return json(toPublicBot(bot), { status: 201 });
});
