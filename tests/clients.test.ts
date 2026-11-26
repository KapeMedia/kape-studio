import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { testDb } from "./helpers";
import { createClient, createProject, listBrandAssets, listProjects, setClientArchived, listClients } from "@/server/services/clients";
import { saveBrandAsset } from "@/server/services/assets";

describe("clients service", () => {
  it("creates a client with unique slug and normalised diacritics", async () => {
    const db = await testDb();
    const a = await createClient(db, { name: "Epil Point", tone: "cald, fără ştiri" });
    const b = await createClient(db, { name: "Epil Point" });
    expect(a.slug).toBe("epil-point");
    expect(b.slug).toBe("epil-point-2");
    expect(a.tone).toBe("cald, fără știri");
  });

  it("archives clients and hides them from the list", async () => {
    const db = await testDb();
    const c = await createClient(db, { name: "Temp Client" });
    await setClientArchived(db, c.id, true);
    expect((await listClients(db)).some((x) => x.id === c.id)).toBe(false);
    expect((await listClients(db, { includeArchived: true })).some((x) => x.id === c.id)).toBe(true);
  });

  it("saves brand assets (logo replaces previous, photos accumulate) and projects", async () => {
    const db = await testDb();
    const c = await createClient(db, {
      name: "Brand Test",
      colors: [
        { name: "Roșu", hex: "#C8102E", role: "primary" },
        { name: "Alb", hex: "#FFFFFF", role: "background" },
      ],
    });
    const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#ff0000" } }).png().toBuffer();
    await saveBrandAsset(db, c.id, "logo", { name: "logo.png", type: "image/png", data: png });
    await saveBrandAsset(db, c.id, "logo", { name: "logo2.png", type: "image/png", data: png });
    for (let i = 0; i < 3; i++) await saveBrandAsset(db, c.id, "photo", { name: `p${i}.png`, type: "image/png", data: png });
    await saveBrandAsset(db, c.id, "font", { name: "Brand.ttf", type: "", data: Buffer.from("fake") }, { family: "Brand", role: "heading" });
    const assets = await listBrandAssets(db, c.id);
    expect(assets.filter((a) => a.type === "logo")).toHaveLength(1);
    expect(assets.filter((a) => a.type === "photo")).toHaveLength(3);
    expect(assets.find((a) => a.type === "logo")!.width).toBe(40);
    expect(assets.find((a) => a.type === "font")!.meta.family).toBe("Brand");
    await createProject(db, c.id, { name: "Black Friday 2026" });
    expect(await listProjects(db, c.id)).toHaveLength(1);
  });

  it("rejects unsupported uploads", async () => {
    const db = await testDb();
    const c = await createClient(db, { name: "Bad Upload" });
    await expect(saveBrandAsset(db, c.id, "font", { name: "x.png", type: "image/png", data: Buffer.from("x") })).rejects.toThrow();
  });
});
