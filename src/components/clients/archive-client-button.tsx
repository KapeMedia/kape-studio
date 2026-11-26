"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { archiveClientAction } from "@/app/actions/clients";

export function ArchiveClientButton({ clientId, archived }: { clientId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() => {
        if (!archived && !confirm("Arhivezi clientul? Îl poți restaura din Setări.")) return;
        start(async () => {
          await archiveClientAction(clientId, !archived);
          router.refresh();
        });
      }}
    >
      {archived ? "Restaurează clientul" : "Arhivează clientul"}
    </Button>
  );
}
