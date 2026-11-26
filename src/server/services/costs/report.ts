import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import type { DB } from "../../db/connect";
import { clients, llmCalls } from "../../db/schema";

export function monthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Total cost (USD) since `from`, plus the breakdown per client and per provider. */
export async function costReport(db: DB, from: Date = monthStart()) {
  const [total] = await db.select({ v: sum(llmCalls.costUsd) }).from(llmCalls).where(gte(llmCalls.createdAt, from));
  const perClient = await db
    .select({ clientId: llmCalls.clientId, name: clients.name, slug: clients.slug, cost: sum(llmCalls.costUsd), calls: sql<number>`count(*)::int` })
    .from(llmCalls)
    .leftJoin(clients, eq(clients.id, llmCalls.clientId))
    .where(gte(llmCalls.createdAt, from))
    .groupBy(llmCalls.clientId, clients.name, clients.slug)
    .orderBy(desc(sum(llmCalls.costUsd)));
  const perProvider = await db
    .select({ provider: llmCalls.provider, model: llmCalls.model, cost: sum(llmCalls.costUsd), calls: sql<number>`count(*)::int`, failed: sql<number>`sum(case when ${llmCalls.ok} then 0 else 1 end)::int` })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, from))
    .groupBy(llmCalls.provider, llmCalls.model);
  return {
    total: Number(total?.v ?? 0),
    perClient: perClient.map((r) => ({ ...r, cost: Number(r.cost ?? 0) })),
    perProvider: perProvider.map((r) => ({ ...r, cost: Number(r.cost ?? 0) })),
  };
}

export async function clientMonthCost(db: DB, clientId: string, from: Date = monthStart()) {
  const [r] = await db.select({ v: sum(llmCalls.costUsd) }).from(llmCalls).where(and(eq(llmCalls.clientId, clientId), gte(llmCalls.createdAt, from)));
  return Number(r?.v ?? 0);
}
