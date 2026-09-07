import { logAudit } from "@/lib/audit";
import { sessionGuard } from "@/lib/guard";
import { handler, json, readJson } from "@/lib/http";
import { deleteUser, toPublicUser, updateUser } from "@/lib/services/users";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Params) => {
  const { user, ip } = await sessionGuard(req);
  const { id } = await params;
  const body = await readJson(req);
  const updated = await updateUser(user, id, {
    role: typeof body.role === "string" ? body.role : undefined,
    active: typeof body.active === "boolean" ? body.active : undefined,
    password: typeof body.password === "string" && body.password ? body.password : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
    botLimitOverride:
      body.botLimitOverride === undefined
        ? undefined
        : body.botLimitOverride === null || body.botLimitOverride === ""
          ? null
          : Number(body.botLimitOverride),
    resetLock: body.resetLock === true,
  });
  await logAudit(user, "user.update", id, ip, { fields: Object.keys(body).filter((k) => k !== "password"), passwordChanged: Boolean(body.password) });
  return json(await toPublicUser(updated));
});

export const DELETE = handler(async (req: Request, { params }: Params) => {
  const { user, ip } = await sessionGuard(req);
  const { id } = await params;
  await deleteUser(user, id);
  await logAudit(user, "user.delete", id, ip);
  return json({ deleted: true });
});
