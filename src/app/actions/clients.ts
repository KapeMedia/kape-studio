"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import {
  createClient,
  createProject,
  getClientById,
  setClientArchived,
  updateClient,
  updateProject,
  type ClientInput,
} from "@/server/services/clients";
import {
  deleteBrandAsset,
  deleteReference,
  saveBrandAsset,
  saveReferenceImage,
  updateFontMeta,
  type AssetType,
} from "@/server/services/assets";
import { brandColorSchema } from "@/lib/types";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join("; ");
  if (e instanceof Error) return e.message;
  return "Eroare necunoscută";
}

export async function createClientAction(input: ClientInput): Promise<ActionResult<{ slug: string }>> {
  await requireUser();
  try {
    const c = await createClient(await getDb(), input);
    revalidatePath("/", "layout");
    return { ok: true, data: { slug: c.slug } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateClientAction(id: string, input: Partial<ClientInput>): Promise<ActionResult> {
  await requireUser();
  try {
    await updateClient(await getDb(), id, input);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function saveColorsAction(id: string, colors: unknown): Promise<ActionResult> {
  await requireUser();
  try {
    const parsed = z.array(brandColorSchema).parse(colors);
    await updateClient(await getDb(), id, { colors: parsed });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function archiveClientAction(id: string, archived: boolean) {
  await requireUser();
  await setClientArchived(await getDb(), id, archived);
  revalidatePath("/", "layout");
  if (archived) redirect("/");
}

export async function uploadBrandAssetsAction(clientId: string, form: FormData): Promise<ActionResult> {
  await requireUser();
  try {
    const db = await getDb();
    const client = await getClientById(db, clientId);
    if (!client) throw new Error("Client inexistent");
    const type = String(form.get("type")) as AssetType;
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error("Alege cel puțin un fișier.");
    for (const f of files) {
      await saveBrandAsset(
        db,
        clientId,
        type,
        { name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) },
        {
          family: form.get("family")?.toString(),
          role: form.get("role") === "body" ? "body" : "heading",
        },
      );
    }
    revalidatePath(`/clients/${client.slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteBrandAssetAction(id: string): Promise<ActionResult> {
  await requireUser();
  await deleteBrandAsset(await getDb(), id);
  revalidatePath("/clients", "layout");
  return { ok: true };
}

export async function updateFontMetaAction(
  id: string,
  meta: { family?: string; role?: "heading" | "body"; missingGlyphs?: string[] },
): Promise<ActionResult> {
  await requireUser();
  await updateFontMeta(await getDb(), id, meta);
  revalidatePath("/clients", "layout");
  return { ok: true };
}

export async function createProjectAction(clientId: string, input: { name: string; description?: string }): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  try {
    const p = await createProject(await getDb(), clientId, input);
    revalidatePath("/clients", "layout");
    return { ok: true, data: { id: p.id } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateProjectAction(
  id: string,
  input: { name?: string; description?: string; status?: "active" | "archived" },
): Promise<ActionResult> {
  await requireUser();
  try {
    await updateProject(await getDb(), id, input);
    revalidatePath("/clients", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function uploadReferencesAction(clientId: string, projectId: string, form: FormData): Promise<ActionResult> {
  await requireUser();
  try {
    const db = await getDb();
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const note = form.get("note")?.toString() ?? "";
    for (const f of files) {
      await saveReferenceImage(db, clientId, projectId, { name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) }, note);
    }
    revalidatePath("/clients", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteReferenceAction(id: string): Promise<ActionResult> {
  await requireUser();
  await deleteReference(await getDb(), id);
  revalidatePath("/clients", "layout");
  return { ok: true };
}
