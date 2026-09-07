import { getStore } from "./db";
import type { RealtimeEvent } from "./types";

export interface SseOptions {
  /** Hanya kirim event yang lolos filter ini */
  filter: (e: RealtimeEvent) => boolean;
  /** Cursor awal (Last-Event-ID) */
  since: number | null;
  /** Durasi maksimum koneksi sebelum ditutup (client akan reconnect otomatis) */
  maxMs?: number;
  pollMs?: number;
}

/**
 * Server-Sent Events berbasis polling tabel events. Cocok untuk serverless (Vercel):
 * koneksi dibatasi maxMs lalu browser/EventSource reconnect membawa Last-Event-ID
 * sehingga tidak ada event yang terlewat.
 */
export async function sseResponse(req: Request, opts: SseOptions): Promise<Response> {
  const store = await getStore();
  const encoder = new TextEncoder();
  const pollMs = opts.pollMs ?? 1000;
  const maxMs = opts.maxMs ?? 55_000;
  let cursor = opts.since ?? (await store.latestSeq());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearInterval(heartbeat);
        clearTimeout(deadline);
        try {
          controller.close();
        } catch {
          /* sudah ditutup */
        }
      };

      send(`retry: 1500\nevent: ready\nid: ${cursor}\ndata: ${JSON.stringify({ cursor, store: store.kind })}\n\n`);

      let polling = false;
      const timer = setInterval(async () => {
        if (polling || closed) return;
        polling = true;
        try {
          const events = await store.eventsSince(cursor, 200);
          for (const e of events) {
            cursor = e.seq;
            if (!opts.filter(e)) continue;
            send(`id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
          }
        } catch (err) {
          send(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : "poll error" })}\n\n`);
        } finally {
          polling = false;
        }
      }, pollMs);
      const heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), 15_000);
      const deadline = setTimeout(close, maxMs);
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function parseSince(req: Request): number | null {
  const header = req.headers.get("last-event-id");
  const q = new URL(req.url).searchParams.get("since");
  const raw = header ?? q;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
