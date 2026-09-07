import { decryptSecret, encryptSecret, maskToken, randomId } from "../crypto";
import { getStore } from "../db";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { ROLE_SPEC } from "../roles";
import { checkTelegramToken, parseTelegramToken, TELEGRAM_ID_RE } from "../telegram";
import type { Bot, BotStatus, PublicBot, User } from "../types";
import { effectiveBotLimit } from "./users";

export function toPublicBot(b: Bot, ownerName?: string): PublicBot {
  return {
    id: b.id,
    ownerId: b.ownerId,
    ownerName,
    name: b.name,
    tokenMasked: b.tokenMasked,
    botNumericId: b.botNumericId,
    telegramId: b.telegramId,
    botUsername: b.botUsername,
    status: b.status,
    note: b.note,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    lastCheckedAt: b.lastCheckedAt,
    lastCheckOk: b.lastCheckOk,
  };
}

export function canAccessBot(actor: User, bot: Bot): boolean {
  return bot.ownerId === actor.id || ROLE_SPEC[actor.role].manageAll;
}

export async function listBots(actor: User, opts: { all?: boolean } = {}): Promise<Bot[]> {
  const store = await getStore();
  if (opts.all && ROLE_SPEC[actor.role].manageAll) return store.bots.all();
  return store.bots.find((b) => b.ownerId === actor.id);
}

export async function getBot(actor: User, id: string): Promise<Bot> {
  const store = await getStore();
  const bot = await store.bots.get(id);
  if (!bot) throw notFound("Bot tidak ditemukan");
  if (!canAccessBot(actor, bot)) throw forbidden();
  return bot;
}

export function revealToken(bot: Bot): string {
  return decryptSecret(bot.tokenEnc);
}

export interface CreateBotInput {
  token: string;
  telegramId: string;
  name?: string;
  note?: string;
  status?: BotStatus;
  verify?: boolean;
}

export async function createBot(actor: User, input: CreateBotInput): Promise<Bot> {
  const store = await getStore();
  const token = (input.token ?? "").trim();
  const parsed = parseTelegramToken(token);
  if (!parsed) throw badRequest("Format token Telegram tidak valid. Contoh: 123456789:AAH...");
  const telegramId = (input.telegramId ?? "").trim();
  if (!TELEGRAM_ID_RE.test(telegramId)) throw badRequest("ID Telegram harus berupa angka (5-20 digit)");

  const limit = effectiveBotLimit(actor);
  const owned = await store.bots.count((b) => b.ownerId === actor.id);
  if (owned >= limit) {
    throw forbidden(
      `Limit role ${ROLE_SPEC[actor.role].label} tercapai (${owned}/${limit}). Upgrade role untuk menambah bot.`,
      "limit_reached",
    );
  }

  const dup = await store.bots.findOne((b) => b.botNumericId === parsed.numericId);
  if (dup) throw conflict("Bot dengan token/ID ini sudah terdaftar", "duplicate_bot");

  let botUsername: string | null = null;
  let lastCheckedAt: string | null = null;
  let lastCheckOk: boolean | null = null;
  if (input.verify) {
    const check = await checkTelegramToken(token);
    lastCheckedAt = new Date().toISOString();
    lastCheckOk = check.ok;
    botUsername = check.username;
    if (!check.ok) throw badRequest(`Token ditolak Telegram: ${check.error}`, "telegram_rejected");
  }

  const now = new Date().toISOString();
  const bot: Bot = {
    id: randomId(),
    ownerId: actor.id,
    name: (input.name ?? "").trim().slice(0, 60) || botUsername || `Bot ${parsed.numericId}`,
    tokenEnc: encryptSecret(token),
    tokenMasked: maskToken(token),
    botNumericId: parsed.numericId,
    telegramId,
    botUsername,
    status: input.status === "inactive" ? "inactive" : "active",
    note: (input.note ?? "").trim().slice(0, 200),
    createdAt: now,
    updatedAt: now,
    lastCheckedAt,
    lastCheckOk,
  };
  await store.bots.insert(bot);

  const after = await store.bots.count((b) => b.ownerId === actor.id);
  if (after > limit) {
    await store.bots.remove(bot.id);
    throw forbidden(`Limit role ${ROLE_SPEC[actor.role].label} tercapai`, "limit_reached");
  }

  await store.pushEvent({ type: "bot.created", ownerId: actor.id, payload: toPublicBot(bot) as unknown as Record<string, unknown> });
  return bot;
}

export interface UpdateBotInput {
  name?: string;
  note?: string;
  status?: BotStatus;
  telegramId?: string;
  token?: string;
}

export async function updateBot(actor: User, id: string, input: UpdateBotInput): Promise<Bot> {
  const store = await getStore();
  const bot = await getBot(actor, id);
  const next: Bot = { ...bot, updatedAt: new Date().toISOString() };
  if (input.name !== undefined) next.name = String(input.name).trim().slice(0, 60) || bot.name;
  if (input.note !== undefined) next.note = String(input.note).trim().slice(0, 200);
  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "inactive") throw badRequest("Status tidak valid");
    next.status = input.status;
  }
  if (input.telegramId !== undefined) {
    const t = String(input.telegramId).trim();
    if (!TELEGRAM_ID_RE.test(t)) throw badRequest("ID Telegram harus berupa angka");
    next.telegramId = t;
  }
  if (input.token !== undefined) {
    const token = String(input.token).trim();
    const parsed = parseTelegramToken(token);
    if (!parsed) throw badRequest("Format token Telegram tidak valid");
    const dup = await store.bots.findOne((b) => b.botNumericId === parsed.numericId && b.id !== bot.id);
    if (dup) throw conflict("Token ini sudah dipakai bot lain", "duplicate_bot");
    next.tokenEnc = encryptSecret(token);
    next.tokenMasked = maskToken(token);
    next.botNumericId = parsed.numericId;
    next.botUsername = null;
    next.lastCheckedAt = null;
    next.lastCheckOk = null;
  }
  await store.bots.update(bot.id, next);
  await store.pushEvent({ type: "bot.updated", ownerId: bot.ownerId, payload: toPublicBot(next) as unknown as Record<string, unknown> });
  return next;
}

export async function deleteBot(actor: User, id: string): Promise<void> {
  const store = await getStore();
  const bot = await getBot(actor, id);
  await store.bots.remove(bot.id);
  await store.pushEvent({ type: "bot.deleted", ownerId: bot.ownerId, payload: { id: bot.id, name: bot.name } });
}

export async function verifyBot(actor: User, id: string): Promise<{ bot: Bot; ok: boolean; error: string | null }> {
  const store = await getStore();
  const bot = await getBot(actor, id);
  const check = await checkTelegramToken(revealToken(bot));
  const next: Bot = {
    ...bot,
    botUsername: check.username ?? bot.botUsername,
    lastCheckedAt: new Date().toISOString(),
    lastCheckOk: check.ok,
    updatedAt: new Date().toISOString(),
  };
  await store.bots.update(bot.id, next);
  await store.pushEvent({ type: "bot.updated", ownerId: bot.ownerId, payload: toPublicBot(next) as unknown as Record<string, unknown> });
  return { bot: next, ok: check.ok, error: check.error };
}
