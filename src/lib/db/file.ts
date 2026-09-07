import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ApiKey, AuditEntry, Bot, RealtimeEvent, User } from "../types";
import type { Collection, Store } from "./store";

interface FileData {
  users: User[];
  bots: Bot[];
  api_keys: ApiKey[];
  audit: AuditEntry[];
  events: RealtimeEvent[];
  seq: number;
}

const EMPTY: FileData = { users: [], bots: [], api_keys: [], audit: [], events: [], seq: 0 };

class FileCollection<T extends { id: string }> implements Collection<T> {
  constructor(
    private readonly read: () => T[],
    private readonly write: (rows: T[]) => void,
  ) {}

  async all(): Promise<T[]> {
    return [...this.read()];
  }
  async get(id: string): Promise<T | null> {
    return this.read().find((d) => d.id === id) ?? null;
  }
  async find(pred: (doc: T) => boolean): Promise<T[]> {
    return this.read().filter(pred);
  }
  async findOne(pred: (doc: T) => boolean): Promise<T | null> {
    return this.read().find(pred) ?? null;
  }
  async count(pred?: (doc: T) => boolean): Promise<number> {
    return pred ? this.read().filter(pred).length : this.read().length;
  }
  async insert(doc: T): Promise<T> {
    const rows = this.read();
    if (rows.some((d) => d.id === doc.id)) throw new Error("Duplicate id");
    this.write([...rows, doc]);
    return doc;
  }
  async update(id: string, patch: Partial<T> | ((doc: T) => T)): Promise<T | null> {
    const rows = this.read();
    const idx = rows.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    const next = typeof patch === "function" ? patch(rows[idx]) : { ...rows[idx], ...patch };
    rows[idx] = next;
    this.write(rows);
    return next;
  }
  async remove(id: string): Promise<boolean> {
    const rows = this.read();
    const next = rows.filter((d) => d.id !== id);
    this.write(next);
    return next.length !== rows.length;
  }
  async removeWhere(pred: (doc: T) => boolean): Promise<number> {
    const rows = this.read();
    const next = rows.filter((d) => !pred(d));
    this.write(next);
    return rows.length - next.length;
  }
}

/**
 * Penyimpanan berbasis file JSON — hanya untuk development lokal.
 * Di Vercel filesystem tidak persisten, jadi wajib pakai DATABASE_URL (Postgres).
 */
export class FileStore implements Store {
  readonly kind = "file" as const;
  private data: FileData = structuredClone(EMPTY);
  private readonly path: string;
  users: Collection<User>;
  bots: Collection<Bot>;
  apiKeys: Collection<ApiKey>;
  audit: Collection<AuditEntry>;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, "alex-database.json");
    if (existsSync(this.path)) {
      try {
        this.data = { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(this.path, "utf8")) };
      } catch {
        this.data = structuredClone(EMPTY);
      }
    }
    const col = <K extends "users" | "bots" | "api_keys" | "audit">(key: K) =>
      new FileCollection<FileData[K][number]>(
        () => this.data[key] as FileData[K][number][],
        (rows) => {
          (this.data[key] as unknown) = rows;
          this.flush();
        },
      );
    this.users = col("users") as Collection<User>;
    this.bots = col("bots") as Collection<Bot>;
    this.apiKeys = col("api_keys") as Collection<ApiKey>;
    this.audit = col("audit") as Collection<AuditEntry>;
  }

  private flush() {
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  async init(): Promise<void> {}

  async pushEvent(e: Omit<RealtimeEvent, "seq" | "at">): Promise<RealtimeEvent> {
    const ev: RealtimeEvent = { ...e, seq: ++this.data.seq, at: new Date().toISOString() };
    this.data.events.push(ev);
    if (this.data.events.length > 1000) this.data.events.splice(0, this.data.events.length - 1000);
    this.flush();
    return ev;
  }

  async eventsSince(seq: number, limit = 100): Promise<RealtimeEvent[]> {
    return this.data.events.filter((e) => e.seq > seq).slice(0, limit);
  }

  async latestSeq(): Promise<number> {
    return this.data.seq;
  }
}
