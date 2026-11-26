"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import {
  createStyle,
  publishStyleVersion,
  saveStyleVersion,
  saveTemplate,
  setStyleArchived,
  updateFormat,
  type formatUpdateSchema,
  type styleMetaSchema,
  type styleVersionInputSchema,
} from "@/server/services/library";
import { getStorage, makeKey } from "@/server/providers/storage";
import { detectMime } from "@/server/services/assets";
import type { ActionResult } from "./clients";

function err(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: false, error: e instanceof Error ? e.message : "Eroare necunoscută" };
}

export async function updateFormatAction(id: string, input: z.input<typeof formatUpdateSchema>): Promise<ActionResult> {
  await requireUser();
  try {
    await updateFormat(await getDb(), id, input);
    revalidatePath("/library");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function saveTemplateAction(id: string | null, input: { name: string; description?: string; definition: unknown }): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  try {
    const t = await saveTemplate(await getDb(), id, input);
    revalidatePath("/library");
    return { ok: true, data: { id: t.id } };
  } catch (e) {
    return err(e);
  }
}

export async function saveStyleAction(
  styleId: string | null,
  meta: z.input<typeof styleMetaSchema>,
  version: z.input<typeof styleVersionInputSchema>,
): Promise<ActionResult<{ styleId: string; versionId?: string }>> {
  await requireUser();
  try {
    const db = await getDb();
    if (!styleId) {
      const s = await createStyle(db, meta, version);
      revalidatePath("/library");
      return { ok: true, data: { styleId: s.id } };
    }
    const v = await saveStyleVersion(db, styleId, meta, version);
    revalidatePath("/library");
    return { ok: true, data: { styleId, versionId: v.id } };
  } catch (e) {
    return err(e);
  }
}

export async function publishStyleVersionAction(styleId: string, versionId: string): Promise<ActionResult> {
  await requireUser();
  try {
    await publishStyleVersion(await getDb(), styleId, versionId);
    revalidatePath("/library");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function archiveStyleAction(styleId: string, archived: boolean): Promise<ActionResult> {
  await requireUser();
  await setStyleArchived(await getDb(), styleId, archived);
  revalidatePath("/library");
  return { ok: true };
}

export async function uploadStyleReferenceAction(form: FormData): Promise<ActionResult<{ keys: string[] }>> {
  await requireUser();
  try {
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const keys: string[] = [];
    for (const f of files) {
      const mime = detectMime(f);
      if (!mime.startsWith("image/")) throw new Error("Doar imagini.");
      const key = makeKey("styles/references", mime);
      await getStorage().put(key, Buffer.from(await f.arrayBuffer()), mime);
      keys.push(key);
    }
    return { ok: true, data: { keys } };
  } catch (e) {
    return err(e);
  }
}
