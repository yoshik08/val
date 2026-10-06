import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

/**
 * Next.js strips the /val basePath before route handlers see the request,
 * which breaks Auth.js (it parses actions and builds callback URLs from
 * the URL it receives). Re-add /val here so Auth.js sees the public path.
 */
function withPublicPath(req: NextRequest): NextRequest {
  const url = req.nextUrl.clone();
  if (!url.pathname.startsWith("/val")) {
    url.pathname = `/val${url.pathname}`;
  }
  return new NextRequest(url, req);
}

export async function GET(req: NextRequest) {
  return handlers.GET(withPublicPath(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withPublicPath(req));
}
