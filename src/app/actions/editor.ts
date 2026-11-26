"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { saveDocuments, uploadVariantImage } from "@/server/services/editor";
import type { ActionResult } from "./clients";

export async function saveDocumentsAction(variantId: string, documents: Record<string, unknown>, expectedVersion: number): Promise<ActionResult<{ version: number }>> {
  await requireUser();
  try {
    const v = await saveDocuments(await getDb(), variantId, documents, expectedVersion);
    revalidatePath("/clients", "layout");
    return { ok: true, data: { version: v.documentVersion } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eroare la salvare" };
  }
}

export async function uploadVariantImageAction(variantId: string, form: FormData): Promise<ActionResult<{ key: string }>> {
  await requireUser();
  try {
    const f = form.get("file");
    if (!(f instanceof File)) throw new Error("Lipsește fișierul");
    const key = await uploadVariantImage(await getDb(), variantId, { name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) });
    return { ok: true, data: { key } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Eroare la upload" };
  }
}
