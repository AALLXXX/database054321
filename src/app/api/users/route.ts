import { logAudit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { sessionGuard } from "@/lib/guard";
import { handler, json, readJson, str } from "@/lib/http";
import { ROLE_SPEC } from "@/lib/roles";
import { createUser, listVisibleUsers, toPublicUser } from "@/lib/services/users";

export const runtime = "nodejs";

export const GET = handler(async (req: Request) => {
  const { user } = await sessionGuard(req);
  if (!ROLE_SPEC[user.role].canCreate.length) throw forbidden("Role kamu tidak bisa mengelola user");
  const users = await listVisibleUsers(user);
  return json(await Promise.all(users.map(toPublicUser)));
});

export const POST = handler(async (req: Request) => {
  const { user, ip } = await sessionGuard(req);
  const body = await readJson(req);
  const created = await createUser(user, {
    username: str(body.username, 32),
    password: typeof body.password === "string" ? body.password : "",
    role: str(body.role, 16),
    note: str(body.note, 200),
    botLimitOverride:
      body.botLimitOverride === null || body.botLimitOverride === undefined || body.botLimitOverride === ""
        ? null
        : Number(body.botLimitOverride),
  });
  await logAudit(user, "user.create", created.id, ip, { username: created.username, role: created.role });
  return json(await toPublicUser(created), { status: 201 });
});
