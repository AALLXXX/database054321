import { jsonError } from "@/lib/http";
import { ROLE_SPEC } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { parseSince, sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Realtime stream untuk dashboard (cookie session) */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const seeAll = ROLE_SPEC[user.role].manageAll;
    return await sseResponse(req, {
      since: parseSince(req),
      filter: (e) => {
        if (seeAll) return true;
        if (e.type.startsWith("user.")) return e.ownerId === user.id;
        return e.ownerId === user.id;
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
