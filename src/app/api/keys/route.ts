import { logAudit } from "@/lib/audit";
import { sessionGuard } from "@/lib/guard";
import { handler, json, readJson, str } from "@/lib/http";
import { createApiKey, listApiKeys, toPublicApiKey } from "@/lib/services/apikeys";

export const runtime = "nodejs";

export const GET = handler(async (req: Request) => {
  const { user } = await sessionGuard(req);
  return json((await listApiKeys(user)).map(toPublicApiKey));
});

export const POST = handler(async (req: Request) => {
  const { user, ip } = await sessionGuard(req);
  const body = await readJson(req);
  const { key, secret } = await createApiKey(user, { name: str(body.name, 60), scopes: body.scopes });
  await logAudit(user, "apikey.create", key.id, ip, { name: key.name, scopes: key.scopes });
  return json({ key: toPublicApiKey(key), secret }, { status: 201 });
});
