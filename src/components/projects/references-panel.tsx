"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { deleteReferenceAction, uploadReferencesAction } from "@/app/actions/clients";

export type ReferenceView = { id: string; url: string | null; note: string; kind: "inspiration" | "approved_example" | "rejected_example" };

const KIND: Record<ReferenceView["kind"], { label: string; tone: "gray" | "green" | "red" }> = {
  inspiration: { label: "inspirație", tone: "gray" },
  approved_example: { label: "aprobat", tone: "green" },
  rejected_example: { label: "respins", tone: "red" },
};

export function ReferencesPanel({ clientId, projectId, references }: { clientId: string; projectId: string; references: ReferenceView[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Referințe proiect</h3>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) return;
            const fd = new FormData();
            for (const f of Array.from(files)) fd.append("files", f);
            e.target.value = "";
            start(async () => {
              const r = await uploadReferencesAction(clientId, projectId, fd);
              if (!r.ok) toast({ title: "Upload eșuat", description: r.error, tone: "error" });
              router.refresh();
            });
          }}
        />
        <Button variant="outline" size="sm" loading={pending} onClick={() => input.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" /> Adaugă inspirație
        </Button>
      </div>
      {references.length === 0 ? (
        <p className="text-sm text-muted">Nicio referință. Încarcă bannere care îți plac ca inspirație.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
          {references.map((r) => (
            <div key={r.id} className="group relative aspect-square overflow-hidden rounded-md border bg-subtle">
              {r.url && <img src={r.url} alt={r.note} className="h-full w-full object-cover" />}
              <Badge tone={KIND[r.kind].tone} className="absolute bottom-1 left-1">
                {KIND[r.kind].label}
              </Badge>
              <button
                className="absolute top-1 right-1 rounded bg-white/90 p-1 opacity-0 group-hover:opacity-100"
                aria-label="Șterge"
                onClick={() =>
                  start(async () => {
                    await deleteReferenceAction(r.id);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
