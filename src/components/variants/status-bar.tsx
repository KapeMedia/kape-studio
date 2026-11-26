"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Badge, Button, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { STATUS_LABEL, variantAction } from "@/components/projects/variant-card";

export function VariantStatusBar({ variantId, status }: { variantId: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try {
      await variantAction(variantId, body);
      toast({ title: msg, tone: "success" });
      router.refresh();
    } catch (e) {
      toast({ title: "Eroare", description: e instanceof Error ? e.message : "", tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const s = STATUS_LABEL[status] ?? { label: status, tone: "gray" as const };
  return (
    <div className="flex items-center gap-2">
      <Badge tone={s.tone}>{s.label}</Badge>
      <Select
        className="h-8 w-40"
        value={status}
        disabled={busy || status === "pending" || status === "failed"}
        onValueChange={(v) => void act({ action: "status", status: v }, "Status actualizat")}
        options={["draft", "in_review", "approved", "rejected", "delivered"].map((k) => ({ value: k, label: STATUS_LABEL[k]!.label }))}
      />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void act({ action: "approve" }, "Aprobat")}>
        <Check className="h-3.5 w-3.5" /> Aprobă
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void act({ action: "reject", reason: "" }, "Respins")}>
        <X className="h-3.5 w-3.5" /> Respinge
      </Button>
    </div>
  );
}
