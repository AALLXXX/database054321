import { logAudit } from "@/lib/audit";
import { sessionGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { revokeApiKey } from "@/lib/services/apikeys";

export const runtime = "nodejs";

export const DELETE = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user, ip } = await sessionGuard(req);
  const { id } = await params;
  await revokeApiKey(user, id);
  await logAudit(user, "apikey.revoke", id, ip);
  return json({ revoked: true });
});
