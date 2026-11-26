import { getDb } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/current";
import { savePreview } from "@/server/services/review";
import { runQa } from "@/server/services/qa/run-qa";

export const maxDuration = 120;

/** Receives the browser-rendered PNG of the master format (+ text metrics) and runs QA. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return Response.json({ error: "Neautentificat" }, { status: 401 });
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Lipsește fișierul" }, { status: 400 });
  let overflow: Record<string, string[]> = {};
  try {
    overflow = JSON.parse(String(form.get("overflow") ?? "{}")) as Record<string, string[]>;
  } catch {
    overflow = {};
  }
  const db = await getDb();
  const png = Buffer.from(await file.arrayBuffer());
  const key = await savePreview(db, id, png);
  const qa = await runQa(db, id, { previewPng: png, overflowByFormat: overflow }).catch((e: unknown) => {
    console.error("[qa]", e);
    return null;
  });
  return Response.json({ ok: true, previewKey: key, qa });
}
