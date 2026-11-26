"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { createClientAction, updateClientAction } from "@/app/actions/clients";

type Values = {
  name: string;
  industry: "beauty" | "food" | "hospitality" | "other";
  description: string;
  audience: string;
  tone: string;
  dos: string;
  donts: string;
  activeOffers: string;
};

const EMPTY: Values = { name: "", industry: "other", description: "", audience: "", tone: "", dos: "", donts: "", activeOffers: "" };

export function ClientForm({ clientId, initial }: { clientId?: string; initial?: Partial<Values> }) {
  const [v, setV] = useState<Values>({ ...EMPTY, ...initial });
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      if (clientId) {
        const r = await updateClientAction(clientId, v);
        if (r.ok) {
          toast({ title: "Salvat", tone: "success" });
          router.refresh();
        } else toast({ title: "Nu am putut salva", description: r.error, tone: "error" });
      } else {
        const r = await createClientAction(v);
        if (r.ok && r.data) router.push(`/clients/${r.data.slug}?tab=brand`);
        else if (!r.ok) toast({ title: "Nu am putut crea clientul", description: r.error, tone: "error" });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nume client">
          <Input value={v.name} onChange={(e) => set("name", e.target.value)} required minLength={2} placeholder="ex: Epil Point" />
        </Field>
        <Field label="Industrie">
          <Select
            value={v.industry}
            onValueChange={(x) => set("industry", x as Values["industry"])}
            options={[
              { value: "beauty", label: "Beauty" },
              { value: "food", label: "Food" },
              { value: "hospitality", label: "Hospitality" },
              { value: "other", label: "Altele" },
            ]}
          />
        </Field>
      </div>
      <Field label="Descriere">
        <Textarea value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Ce face clientul, servicii principale" />
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Public">
          <Textarea value={v.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Cine cumpără" />
        </Field>
        <Field label="Ton">
          <Textarea value={v.tone} onChange={(e) => set("tone", e.target.value)} placeholder="ex: cald, direct, fără superlative" />
        </Field>
        <Field label="Ce facem (do)">
          <Textarea value={v.dos} onChange={(e) => set("dos", e.target.value)} />
        </Field>
        <Field label="Ce evităm (don't)">
          <Textarea value={v.donts} onChange={(e) => set("donts", e.target.value)} />
        </Field>
      </div>
      <Field label="Oferte active">
        <Textarea value={v.activeOffers} onChange={(e) => set("activeOffers", e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {clientId ? "Salvează" : "Creează clientul"}
        </Button>
      </div>
    </form>
  );
}
