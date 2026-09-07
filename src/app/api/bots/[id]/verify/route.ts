import { logAudit } from "@/lib/audit";
import { sessionGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { toPublicBot, verifyBot } from "@/lib/services/bots";

export const runtime = "nodejs";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user, ip } = await sessionGuard(req);
  rateLimit(`verify:${user.id}`, 30, 60_000);
  const { id } = await params;
  const result = await verifyBot(user, id);
  await logAudit(user, "bot.verify", id, ip, { ok: result.ok });
  return json({ bot: toPublicBot(result.bot), ok: result.ok, error: result.error });
});
