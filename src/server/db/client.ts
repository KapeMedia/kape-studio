import "server-only";
import { connect, type DB } from "./connect";
import { seedDatabase } from "./seed";
import { runMaintenance } from "../services/brain/maintenance";

export type { DB };

type Holder = { promise?: Promise<DB> };
const g = globalThis as unknown as { __kapeDb?: Holder };
const holder: Holder = (g.__kapeDb ??= {});

async function init(): Promise<DB> {
  const db = await connect();
  await seedDatabase(db, { onlyIfEmpty: true });
  await runMaintenance(db).catch((e: unknown) => console.warn("[brain] maintenance failed", e));
  return db;
}

/** Lazily opens the DB once per server process (migrations + seed on first use). */
export function getDb(): Promise<DB> {
  if (!holder.promise) {
    holder.promise = init().catch((err: unknown) => {
      holder.promise = undefined;
      throw err;
    });
  }
  return holder.promise;
}
