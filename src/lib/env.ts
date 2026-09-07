const isProd = process.env.NODE_ENV === "production";

function required(name: string, fallbackDev?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (!isProd && fallbackDev !== undefined) return fallbackDev;
  throw new Error(`Environment variable ${name} wajib diisi`);
}

export const env = {
  isProd,
  appName: process.env.APP_NAME || "Alex Database",
  appUrl: process.env.APP_URL || "https://alex-database.vercel.app",
  databaseUrl: process.env.DATABASE_URL || "",
  dataDir: process.env.DATA_DIR || ".data",
  get sessionSecret() {
    return required("SESSION_SECRET", "dev-session-secret-change-me-please-0123456789");
  },
  get encryptionKey() {
    return required("ENCRYPTION_KEY", "dev-encryption-key-change-me-please-0123456789");
  },
  ownerUsername: process.env.OWNER_USERNAME || "",
  ownerPassword: process.env.OWNER_PASSWORD || "",
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || 5),
  lockoutMinutes: Number(process.env.LOCKOUT_MINUTES || 15),
  apiRateLimitPerMinute: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 120),
};
