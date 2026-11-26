import { describe, expect, it } from "vitest";
import { testDb } from "./helpers";
import { getStyle, listStyles, publishStyleVersion, saveStyleVersion, saveTemplate, listFormats, updateFormat } from "@/server/services/library";

describe("library", () => {
  it("saving a style creates a new version; live version changes only on publish", async () => {
    const db = await testDb();
    const [{ style, version }] = (await listStyles(db)).slice(0, 1) as [Awaited<ReturnType<typeof listStyles>>[number]];
    expect(version?.version).toBe(1);
    const v2 = await saveStyleVersion(db, style.id, { name: style.name }, { templateId: version!.templateId, visualPrompt: "new prompt" });
    expect(v2.version).toBe(2);
    let s = await getStyle(db, style.id);
    expect(s!.current!.version).toBe(1);
    await publishStyleVersion(db, style.id, v2.id);
    s = await getStyle(db, style.id);
    expect(s!.current!.version).toBe(2);
    expect(s!.current!.visualPrompt).toBe("new prompt");
  });

  it("rejects invalid template definitions", async () => {
    const db = await testDb();
    await expect(saveTemplate(db, null, { name: "x", definition: { layouts: {} } })).rejects.toThrow();
    const t = await saveTemplate(db, null, { name: "ok", definition: { layouts: { feed_4x5: { layers: [] } } } });
    expect(t.id).toBeTruthy();
  });

  it("formats are editable", async () => {
    const db = await testDb();
    const f = (await listFormats(db)).find((x) => x.key === "fb_cover")!;
    await updateFormat(db, f.id, { label: f.label, width: 1640, height: 720, safeZone: f.safeZone, notes: "nou", enabled: true });
    expect((await listFormats(db)).find((x) => x.key === "fb_cover")!.height).toBe(720);
  });
});
