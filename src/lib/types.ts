import type { Role } from "./roles";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  /** Naikkan untuk memutus semua sesi login user ini */
  sessionVersion: number;
  note: string;
  /** Override limit bot khusus user ini (null = pakai default role) */
  botLimitOverride: number | null;
}

export type BotStatus = "active" | "inactive";

export interface Bot {
  id: string;
  ownerId: string;
  name: string;
  /** Token Telegram terenkripsi AES-256-GCM */
  tokenEnc: string;
  tokenMasked: string;
  /** Bagian numerik sebelum ':' pada token */
  botNumericId: string;
  /** ID Telegram (chat id / user id) yang dipasangkan */
  telegramId: string;
  botUsername: string | null;
  status: BotStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
}

export type ApiScope = "read" | "write";

export interface ApiKey {
  id: string;
  ownerId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  target: string;
  ip: string;
  at: string;
  meta: Record<string, unknown>;
}

export type EventType =
  | "bot.created"
  | "bot.updated"
  | "bot.deleted"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "apikey.created"
  | "apikey.revoked";

export interface RealtimeEvent {
  seq: number;
  type: EventType;
  /** Pemilik data yang berubah — dipakai untuk filter stream per user */
  ownerId: string | null;
  payload: Record<string, unknown>;
  at: string;
}

export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  note: string;
  botLimit: number | null;
  botCount: number;
}

export interface PublicBot {
  id: string;
  ownerId: string;
  ownerName?: string;
  name: string;
  tokenMasked: string;
  botNumericId: string;
  telegramId: string;
  botUsername: string | null;
  status: BotStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
  lastCheckOk: boolean | null;
}

export interface PublicApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}
