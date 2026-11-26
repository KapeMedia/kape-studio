"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarClient = { id: string; name: string; slug: string; color: string | null };

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        active ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
      )}
    >
      {children}
    </Link>
  );
}

export function Sidebar({ clients }: { clients: SidebarClient[] }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r bg-subtle">
      <Link href="/" className="flex h-12 items-center gap-2 border-b px-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">K</span>
        <span className="text-sm font-semibold tracking-tight">KAPE Studio</span>
      </Link>
      <nav className="flex-1 overflow-y-auto p-3">
        <NavLink href="/" active={pathname === "/"}>
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </NavLink>
        <div className="mt-5 mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">Clienți</span>
          <Link href="/clients/new" className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700" aria-label="Client nou">
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-0.5">
          {clients.map((c) => (
            <NavLink key={c.id} href={`/clients/${c.slug}`} active={pathname.startsWith(`/clients/${c.slug}`)}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10" style={{ background: c.color ?? "#d1d5db" }} />
              <span className="truncate">{c.name}</span>
            </NavLink>
          ))}
          <NavLink href="/clients/new" active={pathname === "/clients/new"}>
            <Plus className="h-4 w-4" /> Client nou
          </NavLink>
        </div>
        <div className="mt-5 space-y-0.5">
          <NavLink href="/library" active={pathname.startsWith("/library")}>
            <BookOpen className="h-4 w-4" /> Bibliotecă
          </NavLink>
          <NavLink href="/settings" active={pathname.startsWith("/settings")}>
            <Settings className="h-4 w-4" /> Setări
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}
