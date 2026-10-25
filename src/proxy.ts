import { NextResponse, type NextRequest } from "next/server";
import { sessionFromToken } from "@/lib/auth/jwt";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  BACKOFFICE_LOGIN,
  DEFAULT_COOKIE_NAMES,
  homePathFor,
  loginPathFor,
  surfaceOfPath,
  type Surface,
} from "@/lib/bff/surface";

// Proxy runs outside the app's module graph, so it reads the cookie names straight from the
// environment instead of importing the server-only env module. Keep the defaults in sync with
// src/lib/env.ts (both take them from DEFAULT_COOKIE_NAMES).
const COOKIES: Record<Surface, { access: string; refresh: string }> = {
  client: {
    access: process.env.AUTH_ACCESS_COOKIE || DEFAULT_COOKIE_NAMES.client.access,
    refresh: process.env.AUTH_REFRESH_COOKIE || DEFAULT_COOKIE_NAMES.client.refresh,
  },
  backoffice: {
    access: process.env.BACKOFFICE_ACCESS_COOKIE || DEFAULT_COOKIE_NAMES.backoffice.access,
    refresh: process.env.BACKOFFICE_REFRESH_COOKIE || DEFAULT_COOKIE_NAMES.backoffice.refresh,
  },
};

const CLIENT_AUTH_PAGES = ["/login", "/register"];
const CLIENT_PROTECTED = ["/schemes"];

function startsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and Next emit inline style attributes; styles cannot execute code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const surface = surfaceOfPath(pathname);
  const names = COOKIES[surface];
  const accessToken = request.cookies.get(names.access)?.value;
  const session = sessionFromToken(accessToken);

  const redirectTo = (target: string, clearSession = false) => {
    const response = NextResponse.redirect(new URL(target, request.url));
    response.headers.set("Content-Security-Policy", csp);
    // Drop a stale (expired, malformed or unauthorised) session so it is not re-sent on every
    // request. Only this surface's cookies are touched.
    if (clearSession && accessToken) {
      response.cookies.set(names.access, "", { maxAge: 0, path: "/" });
      response.cookies.set(names.refresh, "", { maxAge: 0, path: "/" });
    }
    return response;
  };
  const loginRedirect = (clearSession: boolean, extra = "") => {
    const next = encodeURIComponent(
      safeNextPath(`${pathname}${search}`, homePathFor(surface), surface),
    );
    return redirectTo(`${loginPathFor(surface)}?next=${next}${extra}`, clearSession);
  };

  if (surface === "backoffice") {
    if (pathname === BACKOFFICE_LOGIN) {
      // Staff who are already signed in do not need the login page again.
      if (session?.isAdmin) return redirectTo(homePathFor("backoffice"));
    } else if (!session) {
      return loginRedirect(true);
    } else if (!session.isAdmin && !startsWithSegment(pathname, "/backoffice/forbidden")) {
      return redirectTo("/backoffice/forbidden");
    }
  } else {
    const isProtected = CLIENT_PROTECTED.some((p) => startsWithSegment(pathname, p));
    if (isProtected && !session) return loginRedirect(true);
    if (session && CLIENT_AUTH_PAGES.some((p) => startsWithSegment(pathname, p))) {
      return redirectTo(homePathFor("client"));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (surface === "backoffice") {
    // Staff pages must not be cached by shared proxies or the browser history.
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
