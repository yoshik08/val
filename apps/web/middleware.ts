import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const protectedPaths = ["/dashboard", "/connect"];
  const needsAuth = protectedPaths.some((p) => pathname.startsWith(p));

  if (needsAuth && !req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/connect/:path*"],
};
