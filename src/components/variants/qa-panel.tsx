import { AlertTriangle, CircleAlert, CircleCheck } from "lucide-react";
import type { QaResult } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function QaPanel({ qa }: { qa: QaResult | null }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">QA</span>
        {qa && <span className="text-[11px] text-muted">{formatDateTime(qa.checkedAt)} · vision: {qa.vision}</span>}
      </div>
      {!qa ? (
        <p className="text-xs text-muted">Se verifică după randarea preview-ului (după salvare).</p>
      ) : qa.issues.length === 0 ? (
        <p className="flex items-center gap-1 text-sm text-green-700">
          <CircleCheck className="h-4 w-4" /> Nicio problemă găsită.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {qa.issues.map((i, k) => (
            <li key={k} className="flex items-start gap-1.5 text-xs">
              {i.severity === "error" ? <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
              <span>
                {i.message}
                {i.formatKey && <span className="text-muted"> [{i.formatKey}]</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
