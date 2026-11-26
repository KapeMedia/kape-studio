"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

export function ClientPicker({ clients, value }: { clients: { slug: string; name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">Preview cu brandul:</span>
      <Select
        className="w-56"
        value={value}
        onValueChange={(v) => {
          const p = new URLSearchParams(sp.toString());
          p.set("client", v);
          router.push(`${pathname}?${p.toString()}`);
        }}
        options={clients.map((c) => ({ value: c.slug, label: c.name }))}
      />
    </div>
  );
}
