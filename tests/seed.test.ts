import { describe, expect, it } from "vitest";
import { testDb } from "./helpers";
import { clients, formats, projects, styles, users } from "@/server/db/schema";
import { seedDatabase } from "@/server/db/seed";

describe("seed", () => {
  it("creates users, demo clients, formats, styles and projects", async () => {
    const db = await testDb();
    expect(await db.select().from(users)).toHaveLength(3);
    const cs = await db.select().from(clients);
    expect(cs.map((c) => c.name).sort()).toEqual(["Demo Beauty Salon", "Demo Smash Burgers"]);
    expect(await db.select().from(formats)).toHaveLength(5);
    expect(await db.select().from(styles)).toHaveLength(6);
    expect(await db.select().from(projects)).toHaveLength(2);
    // second run is a no-op with onlyIfEmpty
    expect((await seedDatabase(db, { onlyIfEmpty: true })).seeded).toBe(false);
  });
});
