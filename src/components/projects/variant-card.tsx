"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleAlert, CircleCheck, Copy, MoreHorizontal, Pencil, RefreshCw, X } from "lucide-react";
import { Badge, Button, Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Tooltip } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { VariantView } from "@/server/services/generation/queries";
import type { QaResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, { label: string; tone: "gray" | "green" | "yellow" | "red" | "blue" | "accent" }> = {
  pending: { label: "se generează", tone: "blue" },
  failed: { label: "eșuat", tone: "red" },
  draft: { label: "draft", tone: "gray" },
  in_review: { label: "în review", tone: "yellow" },
  approved: { label: "aprobat", tone: "green" },
  rejected: { label: "respins", tone: "red" },
  delivered: { label: "livrat", tone: "accent" },
};

export function QaBadge({ qa }: { qa: QaResult | null }) {
  if (!qa) return <Badge>QA…</Badge>;
  const icon = qa.status === "ok" ? <CircleCheck className="h-3 w-3" /> : qa.status === "warning" ? <AlertTriangle className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />;
  const tone = qa.status === "ok" ? "green" : qa.status === "warning" ? "yellow" : "red";
  return (
    <Tooltip
      content={
        qa.issues.length ? (
          <ul className="space-y-0.5">
            {qa.issues.slice(0, 8).map((i, k) => (
              <li key={k}>• {i.message}</li>
            ))}
          </ul>
        ) : (
          "Nicio problemă găsită"
        )
      }
    >
      <span>
        <Badge tone={tone}>
          {icon} {qa.status === "ok" ? "QA ok" : `${qa.issues.length} ${qa.status === "error" ? "erori" : "avertismente"}`}
        </Badge>
      </span>
    </Tooltip>
  );
}

export async function variantAction(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/variants/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
  if (!res.ok) throw new Error(json.error ?? "Eroare");
  return json;
}

export function VariantCard({ v, slug, onChanged, footer }: { v: VariantView; slug: string; onChanged: () => void; footer?: React.ReactNode }) {
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true);
    try {
      await variantAction(v.id, body);
      if (ok) toast({ title: ok, tone: "success" });
      onChanged();
    } catch (e) {
      toast({ title: "Eroare", description: e instanceof Error ? e.message : "", tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const status = STATUS_LABEL[v.status] ?? { label: v.status, tone: "gray" as const };
  const editorHref = `/clients/${slug}/variants/${v.id}`;
  const ratio = v.masterDoc ? v.masterDoc.width / v.masterDoc.height : 0.8;

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-white", v.status === "approved" && "ring-2 ring-green-500/40")}>
      <Link href={editorHref} className="block bg-subtle" style={{ aspectRatio: String(ratio) }}>
        {v.status === "pending" ? (
          <div className="flex h-full w-full animate-pulse items-center justify-center text-xs text-muted">Se generează imaginea…</div>
        ) : v.status === "failed" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-xs text-red-700">
            <CircleAlert className="h-5 w-5" />
            {v.error ?? "Eșuat"}
          </div>
        ) : v.previewUrl ? (
          <img src={v.previewUrl} alt={v.copy.headline} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full animate-pulse items-center justify-center text-xs text-muted">Se randează…</div>
        )}
      </Link>
      <div className="space-y-2 p-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-medium text-gray-500">#{v.index}</span>
          <Badge tone="accent">{v.angle}</Badge>
          <Badge tone={status.tone}>{status.label}</Badge>
          {v.status !== "pending" && v.status !== "failed" && <QaBadge qa={v.qa} />}
        </div>
        <p className="line-clamp-2 text-sm font-medium">{v.copy.headline}</p>
        {v.rejectReason && v.status === "rejected" && <p className="text-xs text-red-700">Motiv: {v.rejectReason}</p>}
        <div className="flex items-center gap-1">
          <Button size="sm" variant={v.status === "approved" ? "secondary" : "outline"} className="min-w-0 flex-1 gap-1 px-2 text-xs" disabled={busy || v.status === "pending" || v.status === "failed"} onClick={() => act({ action: "approve" }, "Aprobat")}>
            <Check className="h-3.5 w-3.5" /> Aprobă
          </Button>
          <Button size="sm" variant="outline" className="min-w-0 flex-1 gap-1 px-2 text-xs" disabled={busy || v.status === "pending"} onClick={() => setRejectOpen(true)}>
            <X className="h-3.5 w-3.5" /> Respinge
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Mai multe">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={editorHref}>
                  <Pencil className="h-4 w-4" /> Deschide în editor
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={v.status === "pending"} onSelect={() => act({ action: "regenerate_image" }, "Imaginea se regenerează")}>
                <RefreshCw className="h-4 w-4" /> Regenerează imaginea
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => act({ action: "duplicate" }, "Duplicat")}>
                <Copy className="h-4 w-4" /> Duplică
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => act({ action: "status", status: "in_review" })}>Marchează „în review”</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => act({ action: "status", status: "delivered" })}>Marchează „livrat”</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {footer}
      </div>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent title="Respinge varianta" description="Motivul (opțional) ajută la generările următoare.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setRejectOpen(false);
              void act({ action: "reject", reason }, "Respins");
            }}
          >
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: prea aglomerat, culori greșite" autoFocus />
            <div className="flex justify-end">
              <Button type="submit" variant="danger">
                Respinge
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
