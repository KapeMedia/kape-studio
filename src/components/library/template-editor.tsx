"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Checkbox, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { saveTemplateAction } from "@/app/actions/library";
import { TemplatePreviewLazy } from "@/editor/lazy";
import type { BrandView } from "@/editor/template-preview";
import type { FormatSpec } from "@/lib/derive";
import { templateDefinitionSchema, type TemplateDefinition } from "@/lib/template-types";

function parseDefinition(json: string): { ok: true; def: TemplateDefinition } | { ok: false; error: string } {
  try {
    const raw: unknown = JSON.parse(json);
    const r = templateDefinitionSchema.safeParse(raw);
    if (!r.success) return { ok: false, error: r.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") };
    return { ok: true, def: r.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "JSON invalid" };
  }
}

export function TemplateEditor({
  template,
  brand,
  specs,
}: {
  template: { id: string | null; name: string; description: string; definition: TemplateDefinition };
  brand: BrandView;
  specs: FormatSpec[];
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [json, setJson] = useState(JSON.stringify(template.definition, null, 2));
  const [formatKey, setFormatKey] = useState("feed_4x5");
  const [showSafe, setShowSafe] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const parsed = useMemo(() => parseDefinition(json), [json]);
  const [lastGood, setLastGood] = useState<TemplateDefinition>(template.definition);
  const onJsonChange = (value: string) => {
    setJson(value);
    const p = parseDefinition(value);
    if (p.ok) setLastGood(p.def);
  };
  const spec = specs.find((s) => s.key === formatKey) ?? specs[0]!;
  const derived = !lastGood.layouts[formatKey as keyof TemplateDefinition["layouts"]];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nume">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Descriere">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <Field label="Definiție (JSON, coordonate relative 0–1)" hint="Schema: SPEC.md §9.1. Layout-urile lipsă se derivă din feed_4x5.">
            <textarea
              value={json}
              onChange={(e) => onJsonChange(e.target.value)}
              spellCheck={false}
              className="h-[560px] w-full rounded-lg border bg-gray-50 p-3 font-mono text-xs leading-5 focus:border-accent focus:outline-none"
            />
          </Field>
          {!parsed.ok && <pre className="rounded-md bg-red-50 p-2 text-xs whitespace-pre-wrap text-red-700">{parsed.error}</pre>}
          <div className="flex justify-end gap-2">
            {template.id && (
              <Button
                variant="outline"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    if (!parsed.ok) return;
                    const r = await saveTemplateAction(null, { name: `${name} (copie)`, description, definition: parsed.def });
                    if (r.ok && r.data) router.push(`/library/templates/${r.data.id}`);
                  })
                }
              >
                Duplică
              </Button>
            )}
            <Button
              disabled={!parsed.ok}
              loading={pending}
              onClick={() =>
                start(async () => {
                  if (!parsed.ok) return;
                  const r = await saveTemplateAction(template.id, { name, description, definition: parsed.def });
                  if (!r.ok) return toast({ title: "Nu am putut salva", description: r.error, tone: "error" });
                  toast({ title: "Template salvat", tone: "success" });
                  if (!template.id && r.data) router.push(`/library/templates/${r.data.id}`);
                  else router.refresh();
                })
              }
            >
              Salvează
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Select className="w-56" value={formatKey} onValueChange={setFormatKey} options={specs.map((s) => ({ value: s.key, label: s.key }))} />
          <Checkbox checked={showSafe} onChange={setShowSafe} label="Safe zone" />
        </div>
        {derived && <p className="text-xs text-muted">Layout derivat automat din feed_4x5.</p>}
        <div className="flex justify-center rounded-lg border bg-subtle p-4">
          <TemplatePreviewLazy definition={lastGood} format={spec} brand={brand} width={spec.width >= spec.height ? 380 : Math.round(380 * (spec.width / spec.height) * 1.25)} showSafeZone={showSafe} />
        </div>
      </div>
    </div>
  );
}
