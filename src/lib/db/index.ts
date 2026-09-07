import { env } from "../env";
import { FileStore } from "./file";
import { PostgresStore } from "./postgres";
import type { Store } from "./store";

const globalRef = globalThis as unknown as { __alexStore?: Store };

function createStore(): Store {
  if (env.databaseUrl) return new PostgresStore(env.databaseUrl);
  if (env.isProd && process.env.VERCEL) {
    throw new Error("DATABASE_URL wajib diisi saat deploy di Vercel (filesystem tidak persisten)");
  }
  return new FileStore(env.dataDir);
}

export async function getStore(): Promise<Store> {
  if (!globalRef.__alexStore) globalRef.__alexStore = createStore();
  await globalRef.__alexStore.init();
  return globalRef.__alexStore;
}

export type { Store } from "./store";
