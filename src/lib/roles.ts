export const ROLES = ["free", "reseller", "team", "owner"] as const;
export type Role = (typeof ROLES)[number];

export interface RoleSpec {
  label: string;
  description: string;
  /** Maksimal jumlah bot/token yang bisa disimpan. Infinity = tanpa batas */
  botLimit: number;
  /** Maksimal API key aktif */
  apiKeyLimit: number;
  /** Role yang boleh dibuat oleh role ini */
  canCreate: Role[];
  /** Bisa lihat & kelola semua data user lain */
  manageAll: boolean;
  /** Bisa hapus user */
  canDeleteUsers: boolean;
  /** Bisa lihat audit log seluruh sistem */
  viewAudit: boolean;
  color: string;
}

export const ROLE_SPEC: Record<Role, RoleSpec> = {
  free: {
    label: "Free",
    description: "Akun gratis. Limit 1x add bot.",
    botLimit: 1,
    apiKeyLimit: 1,
    canCreate: [],
    manageAll: false,
    canDeleteUsers: false,
    viewAudit: false,
    color: "#94a3b8",
  },
  reseller: {
    label: "Reseller",
    description: "Bisa simpan sampai 25 bot & membuat user Free.",
    botLimit: 25,
    apiKeyLimit: 3,
    canCreate: ["free"],
    manageAll: false,
    canDeleteUsers: false,
    viewAudit: false,
    color: "#38bdf8",
  },
  team: {
    label: "Team",
    description: "Bisa simpan sampai 200 bot & membuat user Free/Reseller.",
    botLimit: 200,
    apiKeyLimit: 10,
    canCreate: ["free", "reseller"],
    manageAll: false,
    canDeleteUsers: true,
    viewAudit: true,
    color: "#a78bfa",
  },
  owner: {
    label: "Owner",
    description: "Pemilik. Full akses ke semua user, bot, dan pengaturan.",
    botLimit: Number.POSITIVE_INFINITY,
    apiKeyLimit: Number.POSITIVE_INFINITY,
    canCreate: ["free", "reseller", "team", "owner"],
    manageAll: true,
    canDeleteUsers: true,
    viewAudit: true,
    color: "#fbbf24",
  },
};

export const ROLE_RANK: Record<Role, number> = { free: 0, reseller: 1, team: 2, owner: 3 };

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function canCreateRole(actor: Role, target: Role): boolean {
  return ROLE_SPEC[actor].canCreate.includes(target);
}

export function outranks(actor: Role, target: Role): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}

export function limitLabel(n: number): string {
  return Number.isFinite(n) ? String(n) : "Unlimited";
}
