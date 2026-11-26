"use client";

import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui";

export function UserMenu({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {name.slice(0, 1)}
        </span>
        <span className="font-medium">{name}</span>
        <span className="text-xs text-muted">{role === "owner" ? "fondator" : "editor"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push("/login")}>
          <UserRound className="h-4 w-4" /> Schimbă utilizatorul
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut className="h-4 w-4" /> Ieși
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
