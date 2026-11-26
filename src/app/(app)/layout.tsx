import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { listClients } from "@/server/services/clients";
import { Sidebar } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const clients = await listClients(db);
  return (
    <div className="flex min-h-screen">
      <Sidebar clients={clients.map((c) => ({ id: c.id, name: c.name, slug: c.slug, color: c.colors.find((x) => x.role === "primary")?.hex ?? null }))} />
      <div className="flex min-w-0 flex-1 flex-col pl-60">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-end border-b bg-white/90 px-6 backdrop-blur">
          <UserMenu name={user.name} role={user.role} />
        </header>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
