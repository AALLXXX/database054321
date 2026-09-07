import { logAudit } from "@/lib/audit";
import { sessionGuard } from "@/lib/guard";
import { handler, json, readJson } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { changeOwnPassword } from "@/lib/services/users";

export const runtime = "nodejs";

export const POST = handler(async (req: Request) => {
  const { user, ip } = await sessionGuard(req);
  const body = await readJson(req);
  await changeOwnPassword(
    user,
    typeof body.currentPassword === "string" ? body.currentPassword : "",
    typeof body.newPassword === "string" ? body.newPassword : "",
  );
  await logAudit(user, "auth.change_password", user.username, ip);
  const res = json({ changed: true, relogin: true });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
});
