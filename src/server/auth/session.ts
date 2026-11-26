import { SignJWT, jwtVerify } from "jose";
import { getAuthSecret } from "./secret";
import { USER_IDS } from "../db/seed-data";

export const SESSION_COOKIE = "kape_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 zile

export type SessionPayload = { userId: string; name: string };

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ name: p.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getAuthSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    if (!payload.sub) return null;
    return { userId: payload.sub, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

/** Local convenience: no TEAM_PASSWORD (and not on Vercel) → automatic login as Onisim. */
export function autoLoginEnabled(): boolean {
  return !process.env.TEAM_PASSWORD && !process.env.VERCEL;
}

export const AUTO_LOGIN_USER: SessionPayload = { userId: USER_IDS.onisim, name: "Onisim" };
