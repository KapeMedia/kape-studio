import { connect, type DB } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed";

/** Fresh in-memory PGlite with migrations + seed. */
export async function testDb(): Promise<DB> {
  const db = await connect({ memory: true });
  await seedDatabase(db);
  return db;
}
