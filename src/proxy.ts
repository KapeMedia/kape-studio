import { NextResponse, type NextRequest } from "next/server";
import {
  AUTO_LOGIN_USER,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  autoLoginEnabled,
  signSession,
  verifySession,
} from "./server/auth/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (autoLoginEnabled() && request.method === "GET") {
    const token = await signSession(AUTO_LOGIN_USER);
    const res = NextResponse.redirect(request.nextUrl);
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
