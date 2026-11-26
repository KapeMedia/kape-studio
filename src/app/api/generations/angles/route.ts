import { asc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/current";
import { getClientById, getProject } from "@/server/services/clients";
import { buildContext } from "@/server/services/context/build-context";
import { loggedCall } from "@/server/services/llm-log";
import { getLLM } from "@/server/providers";
import { formats } from "@/server/db/schema";
import { briefSchema } from "@/lib/types";

export const maxDuration = 120;

const bodySchema = z.object({ projectId: z.string().uuid(), brief: briefSchema });

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Neautentificat" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const db = await getDb();
  const project = await getProject(db, parsed.data.projectId);
  const client = project ? await getClientById(db, project.clientId) : null;
  if (!project || !client) return Response.json({ error: "Proiect inexistent" }, { status: 404 });
  const brief = parsed.data.brief;
  const all = await db.select().from(formats).orderBy(asc(formats.sortOrder));
  const { snapshot } = await buildContext(db, {
    client,
    styleId: brief.styleId,
    formats: all.filter((f) => brief.formats.includes(f.key)),
    brief: { message: brief.message, cta: brief.cta, notes: brief.notes, formats: brief.formats, angles: [] },
    markUsed: false,
  });
  const llm = getLLM();
  try {
    const { result } = await loggedCall(
      db,
      { purpose: "angles", provider: llm.id, model: llm.model, clientId: client.id },
      () => llm.proposeAngles({ contextPrompt: snapshot.prompt, brief: { message: brief.message, cta: brief.cta, notes: brief.notes }, industry: client.industry }),
      (r) => ({ ...r.usage, model: r.model, promptVersion: r.promptVersion }),
    );
    return Response.json({ angles: result.data.angles.slice(0, 5) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Eroare" }, { status: 502 });
  }
}
