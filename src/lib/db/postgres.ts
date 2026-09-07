import postgres, { type Sql } from "postgres";
import type { ApiKey, AuditEntry, Bot, RealtimeEvent, User } from "../types";
import type { Collection, CollectionName, Store } from "./store";
import { COLLECTIONS } from "./store";

type Row = { id: string; data: unknown };

class PgCollection<T extends { id: string }> implements Collection<T> {
  constructor(
    private readonly sql: Sql,
    private readonly table: CollectionName,
  ) {}

  private parse(rows: Row[]): T[] {
    return rows.map((r) => r.data as T);
  }

  async all(): Promise<T[]> {
    const rows = await this.sql<Row[]>`select id, data from ${this.sql(this.table)} order by created_at asc`;
    return this.parse(rows);
  }

  async get(id: string): Promise<T | null> {
    const rows = await this.sql<Row[]>`select id, data from ${this.sql(this.table)} where id = ${id}`;
    return rows.length ? (rows[0].data as T) : null;
  }

  async find(pred: (doc: T) => boolean): Promise<T[]> {
    return (await this.all()).filter(pred);
  }

  async findOne(pred: (doc: T) => boolean): Promise<T | null> {
    return (await this.all()).find(pred) ?? null;
  }

  async count(pred?: (doc: T) => boolean): Promise<number> {
    if (!pred) {
      const rows = await this.sql<{ n: string }[]>`select count(*)::text as n from ${this.sql(this.table)}`;
      return Number(rows[0].n);
    }
    return (await this.find(pred)).length;
  }

  async insert(doc: T): Promise<T> {
    await this.sql`insert into ${this.sql(this.table)} (id, data) values (${doc.id}, ${this.sql.json(doc as never)})`;
    return doc;
  }

  async update(id: string, patch: Partial<T> | ((doc: T) => T)): Promise<T | null> {
    const current = await this.get(id);
    if (!current) return null;
    const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
    await this.sql`update ${this.sql(this.table)} set data = ${this.sql.json(next as never)} where id = ${id}`;
    return next;
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.sql`delete from ${this.sql(this.table)} where id = ${id}`;
    return res.count > 0;
  }

  async removeWhere(pred: (doc: T) => boolean): Promise<number> {
    const targets = (await this.all()).filter(pred).map((d) => d.id);
    if (!targets.length) return 0;
    const res = await this.sql`delete from ${this.sql(this.table)} where id in ${this.sql(targets)}`;
    return res.count;
  }
}

export class PostgresStore implements Store {
  readonly kind = "postgres" as const;
  private readonly sql: Sql;
  private initPromise: Promise<void> | null = null;
  users: Collection<User>;
  bots: Collection<Bot>;
  apiKeys: Collection<ApiKey>;
  audit: Collection<AuditEntry>;

  constructor(url: string) {
    this.sql = postgres(url, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    this.users = new PgCollection<User>(this.sql, "users");
    this.bots = new PgCollection<Bot>(this.sql, "bots");
    this.apiKeys = new PgCollection<ApiKey>(this.sql, "api_keys");
    this.audit = new PgCollection<AuditEntry>(this.sql, "audit");
  }

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        for (const table of COLLECTIONS) {
          await this.sql`create table if not exists ${this.sql(table)} (
            id text primary key,
            data jsonb not null,
            created_at timestamptz not null default now()
          )`;
        }
        await this.sql`create unique index if not exists users_username_idx on users ((lower(data->>'username')))`;
        await this.sql`create index if not exists bots_owner_idx on bots ((data->>'ownerId'))`;
        await this.sql`create index if not exists api_keys_hash_idx on api_keys ((data->>'keyHash'))`;
        await this.sql`create table if not exists events (
          seq bigserial primary key,
          type text not null,
          owner_id text,
          payload jsonb not null default '{}'::jsonb,
          at timestamptz not null default now()
        )`;
      })().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  async pushEvent(e: Omit<RealtimeEvent, "seq" | "at">): Promise<RealtimeEvent> {
    const rows = await this.sql<{ seq: string; at: Date }[]>`
      insert into events (type, owner_id, payload)
      values (${e.type}, ${e.ownerId}, ${this.sql.json(e.payload as never)})
      returning seq::text, at`;
    return { ...e, seq: Number(rows[0].seq), at: rows[0].at.toISOString() };
  }

  async eventsSince(seq: number, limit = 100): Promise<RealtimeEvent[]> {
    const rows = await this.sql<{ seq: string; type: string; owner_id: string | null; payload: unknown; at: Date }[]>`
      select seq::text, type, owner_id, payload, at from events where seq > ${seq} order by seq asc limit ${limit}`;
    return rows.map((r) => ({
      seq: Number(r.seq),
      type: r.type as RealtimeEvent["type"],
      ownerId: r.owner_id,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      at: r.at.toISOString(),
    }));
  }

  async latestSeq(): Promise<number> {
    const rows = await this.sql<{ seq: string | null }[]>`select max(seq)::text as seq from events`;
    return Number(rows[0]?.seq ?? 0);
  }
}
