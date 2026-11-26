"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { setDefaultImageProviderId, type ImageProviderId } from "@/server/providers";
import { testProvider, type ProviderKey } from "@/server/services/provider-status";

export async function testProviderAction(key: ProviderKey) {
  await requireUser();
  const r = await testProvider(await getDb(), key);
  revalidatePath("/settings");
  return r;
}

export async function setDefaultImageProviderAction(id: ImageProviderId) {
  await requireUser();
  if (!["openai", "gemini", "mock"].includes(id)) return { ok: false };
  await setDefaultImageProviderId(await getDb(), id);
  revalidatePath("/settings");
  return { ok: true };
}
