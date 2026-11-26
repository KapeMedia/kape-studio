import Link from "next/link";
import { cn } from "@/lib/utils";

export function TabLinks({ base, active, tabs }: { base: string; active: string; tabs: { key: string; label: string; count?: number }[] }) {
  return (
    <div className="mb-6 flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${base}?tab=${t.key}`}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            active === t.key ? "border-accent text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-muted">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}
