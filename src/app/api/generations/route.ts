import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/current";
import { getProject } from "@/server/services/clients";
import { createGeneration, runGeneration } from "@/server/services/generation/pipeline";
import { listGenerations } from "@/server/services/generation/queries";
import { briefSchema } from "@/lib/types";

// Image generation can take minutes: the pipeline runs after the response (after()), within this limit.
export const maxDuration = 300;

const bodySchema = z.object({ projectId: z.string().uuid(), brief: briefSchema });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Neautentificat" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const db = await getDb();
  const project = await getProject(db, parsed.data.projectId);
  if (!project) return Response.json({ error: "Proiect inexistent" }, { status: 404 });
  const gen = await createGeneration(db, { clientId: project.clientId, projectId: project.id, userId: user.id, brief: parsed.data.brief });
  after(() => runGeneration(db, gen.id));
  return Response.json({ id: gen.id });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const clientId = url.searchParams.get("clientId") ?? undefined;
  if (!projectId && !clientId) return Response.json({ error: "projectId sau clientId lipsă" }, { status: 400 });
  const db = await getDb();
  return Response.json({ generations: await listGenerations(db, { projectId, clientId, limit: 30 }) });
}
