import { apiKeyGuard } from "@/lib/guard";
import { jsonError } from "@/lib/http";
import { ROLE_SPEC } from "@/lib/roles";
import { parseSince, sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/v1/stream (Server-Sent Events) — realtime untuk script eksternal.
 * Header: Authorization: Bearer adb_xxx  (atau ?api_key=adb_xxx untuk EventSource browser)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qsKey = url.searchParams.get("api_key");
    const authedReq = qsKey && !req.headers.get("authorization")
      ? new Request(req.url, { headers: { ...Object.fromEntries(req.headers), authorization: `Bearer ${qsKey}` }, signal: req.signal })
      : req;
    const { user } = await apiKeyGuard(authedReq, "read");
    const seeAll = ROLE_SPEC[user.role].manageAll && url.searchParams.get("all") === "1";
    return await sseResponse(req, {
      since: parseSince(req),
      filter: (e) => (seeAll ? true : e.ownerId === user.id),
    });
  } catch (e) {
    return jsonError(e);
  }
}
