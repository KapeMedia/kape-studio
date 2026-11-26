"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, History, Pin, PinOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { addEntryAction, editEntryAction, entryAction } from "@/app/actions/brain";
import { formatDate, formatDateTime } from "@/lib/utils";

export type EntryRow = {
  id: string;
  text: string;
  kind: "rule" | "fact" | "preference";
  status: "trial" | "active" | "archived";
  scope: { formats?: string[]; styles?: string[] };
  confirmations: number;
  uses: number;
  lastUsedAt: string | null;
  pinned: boolean;
  createdBy: "user" | "ai";
  suggestAgencyWide: boolean;
  createdAt: string;
  source: { quote?: string; authorName?: string; date?: string; variantId?: string } | null;
  events: { type: string; createdAt: string; actorName: string | null }[];
};

const EVENT_LABEL: Record<string, string> = {
  created: "creată",
  confirmed: "confirmată",
  promoted: "promovată",
  edited: "editată",
  archived: "arhivată",
  restored: "restaurată",
};

function EntryItem({ e, slug, formats }: { e: EntryRow; slug: string | null; formats: string[] }) {
  const [text, setText] = useState(e.text);
  const [showHistory, setShowHistory] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast({ title: "Eroare", description: r.error, tone: "error" });
      router.refresh();
    });
  const scopeLabel = [...(e.scope.formats ?? []), ...(e.scope.styles ?? [])];
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start gap-2">
        {e.pinned && <Pin className="mt-2 h-3.5 w-3.5 shrink-0 text-accent" />}
        <Input
          value={text}
          onChange={(x) => setText(x.target.value)}
          onBlur={() => text.trim() !== e.text && text.trim().length >= 3 && run(() => editEntryAction(e.id, { text }))}
          className="h-8 border-transparent px-1 font-medium hover:border-gray-200"
        />
        <div className="flex shrink-0 items-center">
          {e.status === "trial" && (
            <Button size="sm" variant="outline" className="h-8 text-xs" loading={pending} onClick={() => run(() => entryAction(e.id, "confirm"))}>
              <Check className="h-3.5 w-3.5" /> Confirmă
            </Button>
          )}
          {e.suggestAgencyWide && slug && (
            <Button size="icon" variant="ghost" title="Fă-o regulă de agenție" onClick={() => run(() => entryAction(e.id, "agency"))}>
              <Building2 className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" title={e.pinned ? "Desprinde" : "Fixează (mereu în context, prima)"} onClick={() => run(() => entryAction(e.id, e.pinned ? "unpin" : "pin"))}>
            {e.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" title="Istoric" onClick={() => setShowHistory((x) => !x)}>
            <History className="h-4 w-4" />
          </Button>
          {e.status === "archived" ? (
            <Button size="icon" variant="ghost" title="Restaurează" onClick={() => run(() => entryAction(e.id, "restore"))}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" title="Șterge (arhivează)" onClick={() => run(() => entryAction(e.id, "archive"))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          Scope:
          <select
            multiple={false}
            value={e.scope.formats?.[0] ?? ""}
            onChange={(x) => run(() => editEntryAction(e.id, { scope: { ...e.scope, formats: x.target.value ? [x.target.value] : undefined } }))}
            className="rounded border bg-white px-1 py-0.5 text-xs"
            aria-label="Format"
          >
            <option value="">toate formatele</option>
            {formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {scopeLabel.length > 1 && <Badge>{scopeLabel.join(", ")}</Badge>}
        </span>
        <span>folosită de {e.uses} ori</span>
        <span>ultima dată: {e.lastUsedAt ? formatDate(e.lastUsedAt) : "niciodată"}</span>
        {e.confirmations > 0 && <span>{e.confirmations} confirmări</span>}
        <span>{e.createdBy === "ai" ? "din feedback" : "adăugată manual"}</span>
      </div>
      {e.source?.quote && (
        <p className="mt-1.5 pl-1 text-xs text-gray-600">
          {e.source.authorName ?? "—"}, {e.source.date ?? ""}: «{e.source.quote.slice(0, 200)}»{" "}
          {e.source.variantId && slug && (
            <Link href={`/clients/${slug}/variants/${e.source.variantId}`} className="text-accent hover:underline">
              vezi varianta
            </Link>
          )}
        </p>
      )}
      {showHistory && (
        <ul className="mt-2 space-y-0.5 border-t pt-2 pl-1 text-xs text-muted">
          {e.events.map((ev, i) => (
            <li key={i}>
              {formatDateTime(ev.createdAt)} · {EVENT_LABEL[ev.type] ?? ev.type}
              {ev.actorName ? ` de ${ev.actorName}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EntryList({ entries, clientId, slug, formats }: { entries: EntryRow[]; clientId: string | null; slug: string | null; formats: string[] }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"rule" | "fact" | "preference">("rule");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const active = entries.filter((e) => e.status === "active" && e.kind === "rule");
  const trial = entries.filter((e) => e.status === "trial");
  const facts = entries.filter((e) => e.status === "active" && e.kind !== "rule");
  const archived = entries.filter((e) => e.status === "archived");
  const section = (title: string, list: EntryRow[], hint?: string) => (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {title} <span className="text-xs font-normal text-muted">{list.length}</span>
      </h3>
      {hint && <p className="-mt-1 mb-2 text-xs text-muted">{hint}</p>}
      {list.length ? (
        <div className="space-y-2">
          {list.map((e) => (
            <EntryItem key={e.id + e.text} e={e} slug={slug} formats={formats} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Nimic aici.</p>
      )}
    </section>
  );
  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          start(async () => {
            const r = await addEntryAction(clientId, { text, kind });
            if (!r.ok) return toast({ title: "Eroare", description: r.error, tone: "error" });
            setText("");
            router.refresh();
          });
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={clientId ? "Regulă nouă, ex: Nu folosi roz neon." : "Regulă de agenție, ex: Fără emoji în headline."} className="min-w-64 flex-1" />
        {clientId && (
          <Select
            className="w-40"
            value={kind}
            onValueChange={(v) => setKind(v as typeof kind)}
            options={[
              { value: "rule", label: "Regulă" },
              { value: "fact", label: "Fapt" },
              { value: "preference", label: "Preferință" },
            ]}
          />
        )}
        <Button type="submit" loading={pending} disabled={text.trim().length < 3}>
          <Plus className="h-4 w-4" /> Adaugă regulă
        </Button>
      </form>
      {entries.length === 0 && <EmptyState title="Brain gol" description="Regulile apar aici din feedback-ul dat pe variante sau le adaugi manual." />}
      {section("Reguli fixe", active, "Intră în fiecare generare (filtrate după scope).")}
      {clientId && section("Reguli în probă", trial, "Intră în context marcate „în probă”. Devin fixe la „Confirmă” sau după 2 confirmări din feedback. Maxim 15.")}
      {clientId && section("Fapte / preferințe", facts)}
      {section("Arhivate", archived)}
    </div>
  );
}
