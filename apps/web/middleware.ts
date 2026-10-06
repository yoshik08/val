import { auth } from "@/lib/auth";

const BASE = "/val";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  // req.nextUrl.pathname includes basePath when one is configured; accept
  // both forms so the gate works regardless.
  const p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) || "/" : pathname;
  const needsAuth = p === "/connect" || p.startsWith("/connect/");

  if (needsAuth && !req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = `${BASE}/login`;
    url.searchParams.set("next", pathname.startsWith(BASE) ? pathname : `${BASE}${pathname}`);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/val/connect/:path*", "/connect/:path*"],
};
