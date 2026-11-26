"use client";

import { useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export function LoginForm({
  users,
  needsPassword,
  next,
  error,
}: {
  users: { id: string; name: string }[];
  needsPassword: boolean;
  next: string;
  error?: string;
}) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  return (
    <form method="POST" action="/api/auth/login" className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="next" value={next} />
      <div>
        <Label>Cine ești?</Label>
        <div className="grid grid-cols-3 gap-2">
          {users.map((u) => (
            <button
              type="button"
              key={u.id}
              onClick={() => setUserId(u.id)}
              className={cn(
                "rounded-lg border px-2 py-2 text-sm font-medium",
                userId === u.id ? "border-accent bg-accent-soft text-accent" : "hover:bg-gray-50",
              )}
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>
      {needsPassword && (
        <div>
          <Label htmlFor="password">Parola echipei</Label>
          <Input id="password" name="password" type="password" autoFocus required />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error === "password" ? "Parolă greșită." : "Nu am putut să te loghez."}</p>}
      <Button type="submit" className="w-full">
        Intră
      </Button>
    </form>
  );
}
