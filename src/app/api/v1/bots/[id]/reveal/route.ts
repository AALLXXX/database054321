import { logAudit } from "@/lib/audit";
import { getStore } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { apiKeyGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { canAccessBot, revealToken } from "@/lib/services/bots";

export const runtime = "nodejs";

/** GET /api/v1/bots/:id/reveal -> token asli untuk dipakai script bot */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user, key, ip } = await apiKeyGuard(req, "write");
  const { id } = await params;
  const store = await getStore();
  const bots = await store.bots.find((b) => b.id === id || b.botNumericId === id || b.telegramId === id);
  const bot = bots.find((b) => b.id === id) ?? bots[0];
  if (!bot || !canAccessBot(user, bot)) throw notFound("Bot tidak ditemukan");
  await logAudit(user, "api.reveal_token", bot.id, ip, { key: key.prefix });
  return json({
    id: bot.id,
    name: bot.name,
    token: revealToken(bot),
    telegramId: bot.telegramId,
    status: bot.status,
  });
});
