import { logAudit } from "@/lib/audit";
import { sessionGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { getBot, revealToken } from "@/lib/services/bots";

export const runtime = "nodejs";

/** Tampilkan token asli (didekripsi). Setiap akses dicatat di audit log. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user, ip } = await sessionGuard(req);
  rateLimit(`reveal:${user.id}`, 30, 60_000);
  const { id } = await params;
  const bot = await getBot(user, id);
  await logAudit(user, "bot.reveal_token", bot.id, ip, { name: bot.name });
  return json({ id: bot.id, token: revealToken(bot), telegramId: bot.telegramId });
});
