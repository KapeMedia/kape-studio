"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; title: string; description?: string; tone: "default" | "error" | "success" };
type ToastFn = (t: { title: string; description?: string; tone?: ToastItem["tone"] }) => void;

const ToastContext = React.createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return React.useContext(ToastContext);
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const toast = React.useCallback<ToastFn>((t) => {
    setItems((prev) => [...prev, { id: Date.now() + Math.random(), tone: t.tone ?? "default", title: t.title, description: t.description }]);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4500}>
        {children}
        {items.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((x) => x.id !== t.id));
            }}
            className={cn(
              "rounded-lg border bg-white p-3 shadow-md",
              t.tone === "error" && "border-red-200 bg-red-50",
              t.tone === "success" && "border-green-200 bg-green-50",
            )}
          >
            <ToastPrimitive.Title className="text-sm font-medium">{t.title}</ToastPrimitive.Title>
            {t.description && <ToastPrimitive.Description className="mt-0.5 text-sm text-gray-600">{t.description}</ToastPrimitive.Description>}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-[100] flex w-80 flex-col gap-2" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
