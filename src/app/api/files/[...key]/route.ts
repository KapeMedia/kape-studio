import { getStorage } from "@/server/providers/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const storageKey = key.map(decodeURIComponent).join("/");
  const file = await getStorage().get(storageKey);
  if (!file) return new Response("Fișier inexistent", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
