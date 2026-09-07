import { logAudit } from "@/lib/audit";
import { apiKeyGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { toPublicBot, verifyBot } from "@/lib/services/bots";

export const runtime = "nodejs";

/** POST /api/v1/bots/:id/verify -> cek token ke Telegram getMe */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user, key, ip } = await apiKeyGuard(req, "write");
  const { id } = await params;
  const result = await verifyBot(user, id);
  await logAudit(user, "api.bot_verify", id, ip, { key: key.prefix, ok: result.ok });
  return json({ bot: toPublicBot(result.bot), ok: result.ok, error: result.error });
});
