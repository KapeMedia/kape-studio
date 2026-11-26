import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/server/auth/session";

function safeEqual(a: string, b: string) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const userId = String(form.get("userId") ?? "");
  const password = String(form.get("password") ?? "");
  const nextRaw = String(form.get("next") ?? "/");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  const base = new URL(req.url);

  const expected = process.env.TEAM_PASSWORD;
  if (expected && !safeEqual(password, expected)) {
    return NextResponse.redirect(new URL(`/login?error=password&next=${encodeURIComponent(next)}`, base), 303);
  }
  if (!expected && process.env.VERCEL) {
    return NextResponse.redirect(new URL(`/login?error=config`, base), 303);
  }
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return NextResponse.redirect(new URL(`/login?error=user`, base), 303);

  const token = await signSession({ userId: user.id, name: user.name });
  const res = NextResponse.redirect(new URL(next, base), 303);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE, secure: base.protocol === "https:" });
  return res;
}
