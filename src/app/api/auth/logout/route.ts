import { logAudit } from "@/lib/audit";
import { clientIp, handler, json } from "@/lib/http";
import { getSessionUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";

export const POST = handler(async (req: Request) => {
  const user = await getSessionUser();
  if (user) await logAudit(user, "auth.logout", user.username, clientIp(req));
  const res = json({ loggedOut: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
});
