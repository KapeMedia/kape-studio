import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/current";
import { setVariantStatus } from "@/server/services/review";
import { duplicateVariant, regenerateVariantImage } from "@/server/services/generation/pipeline";
import { variants } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().optional() }),
  z.object({ action: z.literal("status"), status: z.enum(["draft", "in_review", "approved", "rejected", "delivered"]) }),
  z.object({ action: z.literal("duplicate") }),
  z.object({ action: z.literal("regenerate_image"), instruction: z.string().optional(), keepDocuments: z.boolean().optional() }),
]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [v] = await db.select().from(variants).where(eq(variants.id, id));
  if (!v) return Response.json({ error: "Variantă inexistentă" }, { status: 404 });
  return Response.json({ variant: v });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return Response.json({ error: "Neautentificat" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Acțiune invalidă" }, { status: 400 });
  const db = await getDb();
  try {
    const a = parsed.data;
    switch (a.action) {
      case "approve":
        await setVariantStatus(db, id, "approved");
        break;
      case "reject":
        await setVariantStatus(db, id, "rejected", a.reason);
        break;
      case "status":
        await setVariantStatus(db, id, a.status);
        break;
      case "duplicate": {
        const copy = await duplicateVariant(db, id);
        return Response.json({ ok: true, id: copy.id });
      }
      case "regenerate_image":
        await db.update(variants).set({ status: "pending", error: null }).where(eq(variants.id, id));
        after(() => regenerateVariantImage(db, id, { instruction: a.instruction, keepDocuments: a.keepDocuments }).catch((e: unknown) => console.error("[regenerate]", e)));
        break;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Eroare" }, { status: 400 });
  }
}
