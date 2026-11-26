"use client";

import { HelpCircle } from "lucide-react";
import { Badge, Button, Dialog, DialogContent, DialogTrigger } from "@/components/ui";
import type { ContextRuleRef, ContextSnapshot } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function Rules({ title, rules, tone }: { title: string; rules: ContextRuleRef[]; tone: "green" | "yellow" | "gray" | "blue" }) {
  if (!rules.length) return null;
  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">{title}</h4>
      <ul className="space-y-1.5">
        {rules.map((r) => (
          <li key={r.id} className="rounded-md border px-2 py-1.5 text-sm">
            <div className="flex items-start gap-2">
              <Badge tone={tone}>{r.pinned ? "fixată" : r.status === "active" ? "fixă" : "în probă"}</Badge>
              <span>{r.text}</span>
            </div>
            {r.sourceQuote && (
              <p className="mt-1 text-xs text-muted">
                {[r.sourceAuthor, r.sourceDate].filter(Boolean).join(", ")}: «{r.sourceQuote}»
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhyDialog({ snapshot }: { snapshot: ContextSnapshot | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!snapshot}>
          <HelpCircle className="h-3.5 w-3.5" /> De ce a făcut asta?
        </Button>
      </DialogTrigger>
      {snapshot && (
        <DialogContent title="De ce a făcut asta?" description={`Contextul trimis modelului la ${formatDateTime(snapshot.builtAt)}.`} className="w-[min(760px,94vw)]">
          <div className="space-y-4">
            <section>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Stil</h4>
              {snapshot.style ? (
                <div className="text-sm">
                  <span className="font-medium">{snapshot.style.name}</span> <Badge tone="accent">v{snapshot.style.version}</Badge>
                  <p className="mt-1 text-xs text-muted">{snapshot.style.copyGuidance}</p>
                </div>
              ) : (
                <p className="text-sm text-muted">Ales automat.</p>
              )}
            </section>
            <Rules title="Reguli de agenție" rules={snapshot.agencyRules} tone="blue" />
            <Rules title="Reguli fixe ale clientului" rules={snapshot.clientRules} tone="green" />
            <Rules title="Reguli în probă" rules={snapshot.trialRules} tone="yellow" />
            <Rules title="Fapte și preferințe" rules={snapshot.facts} tone="gray" />
            {!snapshot.clientRules.length && !snapshot.trialRules.length && <p className="text-sm text-muted">Clientul nu are încă reguli în brain.</p>}
            <section>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Formate</h4>
              <ul className="list-disc pl-5 text-sm">
                {snapshot.formatInstructions.map((f) => (
                  <li key={f.key}>{f.label}</li>
                ))}
              </ul>
            </section>
            {snapshot.examples.length > 0 && (
              <section>
                <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Exemple folosite</h4>
                <ul className="space-y-1 text-sm">
                  {snapshot.examples.map((e) => (
                    <li key={e.variantId + e.kind}>
                      <Badge tone={e.kind === "approved" ? "green" : "red"}>{e.kind === "approved" ? "aprobat" : "respins"}</Badge> „{e.headline}”{e.reason ? ` · motiv: ${e.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Prioritate</h4>
              <p className="text-sm">{snapshot.priorityRule}</p>
            </section>
            <details>
              <summary className="cursor-pointer text-xs text-muted">Promptul complet</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-gray-50 p-3 text-xs whitespace-pre-wrap">{snapshot.prompt}</pre>
            </details>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
