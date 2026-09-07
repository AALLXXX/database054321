import { logAudit } from "@/lib/audit";
import { sessionGuard } from "@/lib/guard";
import { handler, json, readJson } from "@/lib/http";
import { deleteBot, getBot, toPublicBot, updateBot } from "@/lib/services/bots";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (req: Request, { params }: Params) => {
  const { user } = await sessionGuard(req);
  const { id } = await params;
  return json(toPublicBot(await getBot(user, id)));
});

export const PATCH = handler(async (req: Request, { params }: Params) => {
  const { user, ip } = await sessionGuard(req);
  const { id } = await params;
  const body = await readJson(req);
  const bot = await updateBot(user, id, {
    name: typeof body.name === "string" ? body.name : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
    status: body.status === "active" || body.status === "inactive" ? body.status : undefined,
    telegramId: typeof body.telegramId === "string" ? body.telegramId : undefined,
    token: typeof body.token === "string" && body.token ? body.token : undefined,
  });
  await logAudit(user, "bot.update", bot.id, ip, { fields: Object.keys(body) });
  return json(toPublicBot(bot));
});

export const DELETE = handler(async (req: Request, { params }: Params) => {
  const { user, ip } = await sessionGuard(req);
  const { id } = await params;
  await deleteBot(user, id);
  await logAudit(user, "bot.delete", id, ip);
  return json({ deleted: true });
});
