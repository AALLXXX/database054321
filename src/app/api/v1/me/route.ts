import { apiKeyGuard } from "@/lib/guard";
import { handler, json } from "@/lib/http";
import { ROLE_SPEC } from "@/lib/roles";
import { toPublicApiKey } from "@/lib/services/apikeys";
import { toPublicUser } from "@/lib/services/users";

export const runtime = "nodejs";

export const GET = handler(async (req: Request) => {
  const { user, key } = await apiKeyGuard(req, "read");
  return json({ user: await toPublicUser(user), role: ROLE_SPEC[user.role].label, key: toPublicApiKey(key) });
});
