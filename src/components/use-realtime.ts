"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@/lib/types";

export type RealtimeStatus = "connecting" | "live" | "offline";

/**
 * Hook SSE ke /api/stream. EventSource reconnect otomatis membawa Last-Event-ID.
 * onEvent dipanggil untuk setiap event; status dipakai indikator "LIVE".
 */
export function useRealtime(onEvent: (e: RealtimeEvent) => void, url = "/api/stream") {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastAt, setLastAt] = useState<string | null>(null);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    const es = new EventSource(url);
    const types = [
      "bot.created",
      "bot.updated",
      "bot.deleted",
      "user.created",
      "user.updated",
      "user.deleted",
      "apikey.created",
      "apikey.revoked",
    ];
    const handle = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as RealtimeEvent;
        setLastAt(data.at);
        cb.current(data);
      } catch {
        /* abaikan payload rusak */
      }
    };
    es.addEventListener("ready", () => setStatus("live"));
    for (const t of types) es.addEventListener(t, handle);
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? "offline" : "connecting");
    es.onopen = () => setStatus("live");
    return () => es.close();
  }, [url]);

  return { status, lastAt };
}
