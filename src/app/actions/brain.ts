"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { submitFeedback, type FeedbackResult } from "@/server/services/brain/feedback";
import { addManualEntry, archiveEntry, confirmEntry, editEntry, promoteToAgency, restoreEntry } from "@/server/services/brain/entries";
import type { BrainScope } from "@/lib/types";
import type { ActionResult } from "./clients";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Eroare");

export async function submitFeedbackAction(variantId: string, text: string): Promise<ActionResult<FeedbackResult>> {
  const user = await requireUser();
  try {
    const r = await submitFeedback(await getDb(), { variantId, authorId: user.id, text });
    revalidatePath("/clients", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

type EntryOp = "confirm" | "archive" | "restore" | "agency" | "pin" | "unpin";

export async function entryAction(entryId: string, op: EntryOp): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const db = await getDb();
    if (op === "confirm") await confirmEntry(db, entryId, user.id);
    else if (op === "archive") await archiveEntry(db, entryId, user.id);
    else if (op === "restore") await restoreEntry(db, entryId, user.id);
    else if (op === "agency") await promoteToAgency(db, entryId, user.id);
    else await editEntry(db, entryId, { pinned: op === "pin" }, user.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function editEntryAction(entryId: string, input: { text?: string; scope?: BrainScope; kind?: "rule" | "fact" | "preference" }): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await editEntry(await getDb(), entryId, input, user.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function addEntryAction(clientId: string | null, input: { text: string; kind?: "rule" | "fact" | "preference"; scope?: BrainScope }): Promise<ActionResult> {
  const user = await requireUser();
  try {
    if (input.text.trim().length < 3) throw new Error("Textul e prea scurt.");
    await addManualEntry(await getDb(), { clientId, ...input, authorId: user.id, authorName: user.name });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
