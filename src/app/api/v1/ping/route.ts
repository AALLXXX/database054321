import { env } from "@/lib/env";
import { json } from "@/lib/http";

export const runtime = "nodejs";

export function GET() {
  return json({ name: env.appName, version: "v1", time: new Date().toISOString() });
}
