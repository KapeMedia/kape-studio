import path from "node:path";
import fs from "node:fs";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type DB = PgliteDatabase<typeof schema>;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Opens the database and applies migrations.
 * - DATABASE_URL set → Postgres via postgres-js
 * - otherwise → PGlite persisted in ./.data/pglite (or in-memory for tests)
 */
export async function connect(opts: { memory?: boolean } = {}): Promise<DB> {
  if (process.env.DATABASE_URL && !opts.memory) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });
    const pgDb = drizzle(sql, { schema });
    if (process.env.AUTO_MIGRATE !== "false") await migrate(pgDb, { migrationsFolder: MIGRATIONS_FOLDER });
    // Both drivers share the PgDatabase query API; we type everything against the PGlite flavour.
    return pgDb as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  let client: InstanceType<typeof PGlite>;
  if (opts.memory) {
    client = new PGlite();
  } else {
    const dir = path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  }
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
