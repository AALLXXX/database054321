import { hashPassword, randomId, verifyPassword } from "../crypto";
import { getStore } from "../db";
import { env } from "../env";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../errors";
import { canCreateRole, isRole, outranks, ROLE_SPEC, type Role } from "../roles";
import type { PublicUser, User } from "../types";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

export function validateUsername(username: string) {
  if (!USERNAME_RE.test(username)) {
    throw badRequest("Username 3-32 karakter, hanya huruf, angka, titik, garis bawah, atau strip");
  }
}

export function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw badRequest("Password minimal 8 karakter");
  }
}

export function effectiveBotLimit(u: User): number {
  return u.botLimitOverride ?? ROLE_SPEC[u.role].botLimit;
}

export async function toPublicUser(u: User): Promise<PublicUser> {
  const store = await getStore();
  const botCount = await store.bots.count((b) => b.ownerId === u.id);
  const limit = effectiveBotLimit(u);
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    active: u.active,
    createdBy: u.createdBy,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    lockedUntil: u.lockedUntil,
    note: u.note,
    botLimit: Number.isFinite(limit) ? limit : null,
    botCount,
  };
}

export async function findByUsername(username: string): Promise<User | null> {
  const store = await getStore();
  const lower = username.toLowerCase();
  return store.users.findOne((u) => u.username.toLowerCase() === lower);
}

/** Buat owner pertama dari env OWNER_USERNAME/OWNER_PASSWORD kalau belum ada user sama sekali */
export async function ensureBootstrapOwner(): Promise<"created" | "exists" | "skipped"> {
  const store = await getStore();
  if ((await store.users.count()) > 0) return "exists";
  if (!env.ownerUsername || !env.ownerPassword) return "skipped";
  validateUsername(env.ownerUsername);
  validatePassword(env.ownerPassword);
  const now = new Date().toISOString();
  await store.users.insert({
    id: randomId(),
    username: env.ownerUsername,
    passwordHash: hashPassword(env.ownerPassword),
    role: "owner",
    active: true,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    sessionVersion: 1,
    note: "Owner utama (bootstrap dari environment)",
    botLimitOverride: null,
  });
  return "created";
}

export async function needsSetup(): Promise<boolean> {
  const store = await getStore();
  return (await store.users.count()) === 0;
}

export async function createUser(
  actor: User | null,
  input: { username: string; password: string; role: string; note?: string; botLimitOverride?: number | null },
): Promise<User> {
  const store = await getStore();
  validateUsername(input.username);
  validatePassword(input.password);
  if (!isRole(input.role)) throw badRequest("Role tidak valid");
  const role: Role = input.role;

  if (actor) {
    if (!canCreateRole(actor.role, role)) {
      throw forbidden(`Role ${ROLE_SPEC[actor.role].label} tidak bisa membuat user ${ROLE_SPEC[role].label}`);
    }
    if (input.botLimitOverride != null && actor.role !== "owner") {
      throw forbidden("Hanya Owner yang bisa mengatur limit khusus");
    }
  } else if ((await store.users.count()) > 0 || role !== "owner") {
    throw forbidden("Setup awal hanya boleh membuat Owner saat belum ada user");
  }

  if (await findByUsername(input.username)) throw conflict("Username sudah dipakai");

  const now = new Date().toISOString();
  const user: User = {
    id: randomId(),
    username: input.username,
    passwordHash: hashPassword(input.password),
    role,
    active: true,
    createdBy: actor?.id ?? null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    sessionVersion: 1,
    note: input.note?.slice(0, 200) ?? "",
    botLimitOverride: normalizeLimit(input.botLimitOverride),
  };
  await store.users.insert(user);
  await store.pushEvent({ type: "user.created", ownerId: user.id, payload: { id: user.id, username: user.username, role } });
  return user;
}

function normalizeLimit(v: number | null | undefined): number | null {
  if (v == null || v === undefined) return null;
  if (!Number.isFinite(v) || v < 0) throw badRequest("Limit harus angka >= 0");
  return Math.floor(v);
}

export function canManageUser(actor: User, target: User): boolean {
  if (actor.id === target.id) return false;
  if (actor.role === "owner") return true;
  if (!ROLE_SPEC[actor.role].canCreate.length) return false;
  return target.createdBy === actor.id && outranks(actor.role, target.role);
}

export async function listVisibleUsers(actor: User): Promise<User[]> {
  const store = await getStore();
  if (ROLE_SPEC[actor.role].manageAll) return store.users.all();
  return store.users.find((u) => u.createdBy === actor.id || u.id === actor.id);
}

export async function updateUser(
  actor: User,
  targetId: string,
  patch: { role?: string; active?: boolean; password?: string; note?: string; botLimitOverride?: number | null; resetLock?: boolean },
): Promise<User> {
  const store = await getStore();
  const target = await store.users.get(targetId);
  if (!target) throw notFound("User tidak ditemukan");
  if (!canManageUser(actor, target)) throw forbidden();

  const next: User = { ...target, updatedAt: new Date().toISOString() };

  if (patch.role !== undefined) {
    if (!isRole(patch.role)) throw badRequest("Role tidak valid");
    if (!canCreateRole(actor.role, patch.role)) throw forbidden("Tidak bisa memberikan role tersebut");
    next.role = patch.role;
  }
  if (patch.active !== undefined) {
    next.active = Boolean(patch.active);
    if (!next.active) next.sessionVersion += 1;
  }
  if (patch.password !== undefined) {
    validatePassword(patch.password);
    next.passwordHash = hashPassword(patch.password);
    next.sessionVersion += 1;
  }
  if (patch.note !== undefined) next.note = String(patch.note).slice(0, 200);
  if (patch.botLimitOverride !== undefined) {
    if (actor.role !== "owner") throw forbidden("Hanya Owner yang bisa mengatur limit khusus");
    next.botLimitOverride = normalizeLimit(patch.botLimitOverride);
  }
  if (patch.resetLock) {
    next.failedAttempts = 0;
    next.lockedUntil = null;
  }

  const ownersLeft = await store.users.count((u) => u.role === "owner" && u.active && u.id !== target.id);
  if (target.role === "owner" && (next.role !== "owner" || !next.active) && ownersLeft === 0) {
    throw badRequest("Tidak bisa menonaktifkan/menurunkan Owner terakhir");
  }

  await store.users.update(target.id, next);
  await store.pushEvent({ type: "user.updated", ownerId: target.id, payload: { id: target.id, role: next.role, active: next.active } });
  return next;
}

export async function deleteUser(actor: User, targetId: string): Promise<void> {
  const store = await getStore();
  const target = await store.users.get(targetId);
  if (!target) throw notFound("User tidak ditemukan");
  if (!canManageUser(actor, target) || !ROLE_SPEC[actor.role].canDeleteUsers) throw forbidden();
  if (target.role === "owner") {
    const owners = await store.users.count((u) => u.role === "owner" && u.id !== target.id);
    if (owners === 0) throw badRequest("Tidak bisa menghapus Owner terakhir");
  }
  await store.bots.removeWhere((b) => b.ownerId === target.id);
  await store.apiKeys.removeWhere((k) => k.ownerId === target.id);
  await store.users.remove(target.id);
  await store.pushEvent({ type: "user.deleted", ownerId: target.id, payload: { id: target.id, username: target.username } });
}

export async function changeOwnPassword(user: User, current: string, next: string) {
  if (!verifyPassword(current, user.passwordHash)) throw badRequest("Password lama salah");
  validatePassword(next);
  const store = await getStore();
  await store.users.update(user.id, {
    passwordHash: hashPassword(next),
    sessionVersion: user.sessionVersion + 1,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Verifikasi login dengan proteksi brute force: setelah N kali gagal akun terkunci sementara.
 */
export async function authenticate(username: string, password: string): Promise<User> {
  const store = await getStore();
  const user = await findByUsername(username);
  const generic = unauthorized("Username atau password salah", "invalid_credentials");
  if (!user) {
    verifyPassword(password, hashPassword("dummy-timing-pad"));
    throw generic;
  }
  if (!user.active) throw unauthorized("Akun dinonaktifkan. Hubungi owner.", "inactive");
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    throw unauthorized(`Akun terkunci karena terlalu banyak percobaan. Coba lagi dalam ${mins} menit.`, "locked");
  }
  if (!verifyPassword(password, user.passwordHash)) {
    const attempts = user.failedAttempts + 1;
    const locked = attempts >= env.maxLoginAttempts;
    await store.users.update(user.id, {
      failedAttempts: locked ? 0 : attempts,
      lockedUntil: locked ? new Date(Date.now() + env.lockoutMinutes * 60000).toISOString() : null,
    });
    if (locked) throw unauthorized(`Akun dikunci ${env.lockoutMinutes} menit karena ${attempts}x gagal login.`, "locked");
    throw generic;
  }
  const updated = await store.users.update(user.id, {
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date().toISOString(),
  });
  return updated ?? user;
}
