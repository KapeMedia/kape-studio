"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Pencil, Send, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { editEntryAction, entryAction, submitFeedbackAction } from "@/app/actions/brain";
import type { FeedbackItem } from "@/server/services/brain/feedback";
import { formatDateTime } from "@/lib/utils";

type Chip = FeedbackItem["entries"][number];

function RuleChip({ e }: { e: Chip }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(e.text);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  return (
    <div className="rounded-md border bg-subtle p-2 text-xs">
      <div className="mb-1 flex items-center gap-1">
        <Badge tone={e.status === "active" ? "green" : e.status === "trial" ? "yellow" : "gray"}>{e.status === "active" ? "fixă" : e.status === "trial" ? "în probă" : "arhivată"}</Badge>
        {e.scope.formats?.length ? <Badge>{e.scope.formats.join(", ")}</Badge> : null}
      </div>
      {editing ? (
        <div className="flex gap-1">
          <Input value={text} onChange={(x) => setText(x.target.value)} className="h-7 text-xs" autoFocus />
          <Button size="sm" onClick={() => run(async () => (await editEntryAction(e.id, { text }), setEditing(false)))} loading={pending}>
            OK
          </Button>
        </div>
      ) : (
        <p className="text-sm">{e.text}</p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {e.status === "trial" && (
          <Button size="sm" variant="outline" className="h-7 text-xs" loading={pending} onClick={() => run(() => entryAction(e.id, "confirm"))}>
            <Check className="h-3 w-3" /> Confirmă
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing((x) => !x)}>
          <Pencil className="h-3 w-3" /> Editează
        </Button>
        {e.status !== "archived" ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs" loading={pending} onClick={() => run(() => entryAction(e.id, "archive"))}>
            <Trash2 className="h-3 w-3" /> Șterge
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 text-xs" loading={pending} onClick={() => run(() => entryAction(e.id, "restore"))}>
            Restaurează
          </Button>
        )}
        {e.suggestAgencyWide && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" loading={pending} onClick={() => run(() => entryAction(e.id, "agency"))}>
            <Building2 className="h-3 w-3" /> Fă-o regulă de agenție
          </Button>
        )}
      </div>
    </div>
  );
}

export function FeedbackPanel({ variantId, items }: { variantId: string; clientId: string; slug: string; items: FeedbackItem[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [applying, setApplying] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const send = () =>
    start(async () => {
      const r = await submitFeedbackAction(variantId, text);
      if (!r.ok) return toast({ title: "Nu am putut procesa feedback-ul", description: r.error, tone: "error" });
      setText("");
      toast({ title: "Feedback primit", description: r.data?.interpretation.summary });
      router.refresh();
    });

  const applyOneOff = async (fbId: string, instruction: string) => {
    setApplying(fbId);
    try {
      const res = await fetch(`/api/variants/${variantId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "regenerate_image", instruction, keepDocuments: true }) });
      if (!res.ok) throw new Error("Eroare");
      toast({ title: "Se regenerează imaginea cu instrucțiunea…", description: "Pagina se actualizează când e gata." });
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const v = (await (await fetch(`/api/variants/${variantId}`)).json()) as { variant?: { status: string } };
        if (v.variant?.status !== "pending") break;
      }
      router.refresh();
    } catch {
      toast({ title: "Nu am putut aplica", tone: "error" });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3">
      <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Feedback</div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ex: Textul e prea mic pe story și nu mai folosi poze cu femei în costum de baie la clientul ăsta."
        className="min-h-20"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) send();
        }}
      />
      <Button size="sm" className="w-full" onClick={send} loading={pending} disabled={text.trim().length < 2}>
        <Send className="h-3.5 w-3.5" /> Trimite feedback
      </Button>
      {items.map((f) => (
        <div key={f.id} className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted">
            {f.author ?? "—"} · {formatDateTime(f.createdAt)}
          </p>
          <p className="text-sm italic">«{f.text}»</p>
          {f.summary && <p className="rounded-md bg-accent-soft px-2 py-1.5 text-sm text-gray-800">{f.summary}</p>}
          {f.entries.map((e) => (
            <RuleChip key={e.id} e={e} />
          ))}
          {f.oneOff && (
            <div className="rounded-md border border-dashed p-2 text-xs">
              <p className="mb-1">Doar pentru bannerul ăsta: {f.oneOff}</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" loading={applying === f.id} onClick={() => void applyOneOff(f.id, f.oneOff!)}>
                <Wand2 className="h-3 w-3" /> Aplică la banner
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
