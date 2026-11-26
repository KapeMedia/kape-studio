import { asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const db = await getDb();
  const list = await db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.id));
  const needsPassword = !!process.env.TEAM_PASSWORD;
  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-lg font-semibold tracking-tight">KAPE Studio</div>
          <p className="mt-1 text-sm text-muted">Intră în workspace-ul agenției.</p>
        </div>
        <LoginForm users={list} needsPassword={needsPassword} next={sp.next ?? "/"} error={sp.error} />
        {!needsPassword && (
          <p className="mt-4 text-xs text-muted">
            TEAM_PASSWORD nu e setat: login fără parolă (doar pentru dezvoltare locală).
          </p>
        )}
      </div>
    </div>
  );
}
