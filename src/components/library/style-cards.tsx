"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { TemplatePreviewLazy } from "@/editor/lazy";
import type { BrandView } from "@/editor/template-preview";
import type { FormatSpec } from "@/lib/derive";
import type { TemplateDefinition } from "@/lib/template-types";

export type StyleCard = {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  version: number | null;
  archived: boolean;
  definition: TemplateDefinition | null;
};

export function StyleCards({ styles, brand, feed, story, clientSlug }: { styles: StyleCard[]; brand: BrandView; feed: FormatSpec; story: FormatSpec; clientSlug: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {styles.map((s) => (
        <Link key={s.id} href={`/library/styles/${s.id}?client=${clientSlug}`}>
          <Card className="overflow-hidden transition-colors hover:border-gray-300">
            <div className="flex items-end justify-center gap-3 bg-subtle p-4">
              {s.definition ? (
                <>
                  <div className="overflow-hidden rounded shadow-sm">
                    <TemplatePreviewLazy definition={s.definition} format={feed} brand={brand} width={150} />
                  </div>
                  <div className="overflow-hidden rounded shadow-sm">
                    <TemplatePreviewLazy definition={s.definition} format={story} brand={brand} width={105} />
                  </div>
                </>
              ) : (
                <div className="h-40 text-sm text-muted">Fără template</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{s.name}</span>
                <div className="flex gap-1">
                  {s.archived && <Badge tone="yellow">arhivat</Badge>}
                  {s.version && <Badge tone="accent">v{s.version}</Badge>}
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p>
              {s.whenToUse && <p className="mt-2 text-xs text-gray-500">Când: {s.whenToUse}</p>}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function TemplateCards({ templates, brand, feed, story, clientSlug }: { templates: { id: string; name: string; description: string; definition: TemplateDefinition }[]; brand: BrandView; feed: FormatSpec; story: FormatSpec; clientSlug: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((t) => (
        <Link key={t.id} href={`/library/templates/${t.id}?client=${clientSlug}`}>
          <Card className="overflow-hidden hover:border-gray-300">
            <div className="flex items-end justify-center gap-3 bg-subtle p-4">
              <TemplatePreviewLazy definition={t.definition} format={feed} brand={brand} width={150} />
              <TemplatePreviewLazy definition={t.definition} format={story} brand={brand} width={105} />
            </div>
            <div className="p-4">
              <div className="font-medium">{t.name}</div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>
              <p className="mt-2 text-xs text-gray-500">Layout explicit: {Object.keys(t.definition.layouts).join(", ")}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
