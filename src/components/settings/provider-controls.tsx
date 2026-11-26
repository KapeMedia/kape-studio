"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlugZap } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { setDefaultImageProviderAction, testProviderAction } from "@/app/actions/settings";
import type { ProviderKey } from "@/server/services/provider-status";

export function TestConnectionButton({ provider }: { provider: ProviderKey }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        loading={pending}
        onClick={() =>
          start(async () => {
            setResult(await testProviderAction(provider));
            router.refresh();
          })
        }
      >
        <PlugZap className="h-3.5 w-3.5" /> Test conexiune
      </Button>
      {result && <span className={result.ok ? "text-xs text-green-700" : "max-w-72 text-right text-xs text-red-700"}>{result.message}</span>}
    </div>
  );
}

export function DefaultImageProvider({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Select
      className="w-72"
      value={value}
      disabled={pending}
      onValueChange={(v) =>
        start(async () => {
          await setDefaultImageProviderAction(v as "openai" | "gemini" | "mock");
          toast({ title: "Provider implicit salvat", tone: "success" });
          router.refresh();
        })
      }
      options={options}
    />
  );
}
