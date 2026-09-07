import { handler, json } from "@/lib/http";
import { ROLE_SPEC } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { toPublicUser } from "@/lib/services/users";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const user = await requireUser();
  return json({ user: await toPublicUser(user), role: ROLE_SPEC[user.role] });
});
