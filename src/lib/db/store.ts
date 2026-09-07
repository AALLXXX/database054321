import type { ApiKey, AuditEntry, Bot, RealtimeEvent, User } from "../types";

export interface Collection<T extends { id: string }> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  find(pred: (doc: T) => boolean): Promise<T[]>;
  findOne(pred: (doc: T) => boolean): Promise<T | null>;
  count(pred?: (doc: T) => boolean): Promise<number>;
  insert(doc: T): Promise<T>;
  update(id: string, patch: Partial<T> | ((doc: T) => T)): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  removeWhere(pred: (doc: T) => boolean): Promise<number>;
}

export interface Store {
  readonly kind: "postgres" | "file";
  init(): Promise<void>;
  users: Collection<User>;
  bots: Collection<Bot>;
  apiKeys: Collection<ApiKey>;
  audit: Collection<AuditEntry>;
  pushEvent(e: Omit<RealtimeEvent, "seq" | "at">): Promise<RealtimeEvent>;
  eventsSince(seq: number, limit?: number): Promise<RealtimeEvent[]>;
  latestSeq(): Promise<number>;
}

export const COLLECTIONS = ["users", "bots", "api_keys", "audit"] as const;
export type CollectionName = (typeof COLLECTIONS)[number];
