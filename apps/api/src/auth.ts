import { jwtVerify } from "jose";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config";

export interface AuthedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      devSsid?: string;
    }
  }
}

const secret = (): Uint8Array => new TextEncoder().encode(config.apiJwtSecret);

/* Verify an HMAC HS256 API JWT. Payload: { userId, email, exp ~15min }. */
export async function authUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    res.status(401).json({ error: "missing bearer token", code: "AUTH_REQUIRED" });
    return;
  }
  try {
    const { payload } = await jwtVerify(m[1], secret());
    const userId = String(payload.userId || "");
    if (!userId) throw new Error("no userId in token");
    req.user = { id: userId, email: String(payload.email || "") };
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token", code: "AUTH_FAILED" });
  }
}

/* Routes that accept either a JWT (real users) or the dev x-ssid header
   (local testing, no Google — treated as a single dev user). */
export function authFlexible(req: Request, res: Response, next: NextFunction): void {
  const h = req.headers.authorization || "";
  if (/^Bearer\s+/i.test(h)) {
    void authUser(req, res, next);
    return;
  }
  const ssid = String(req.headers["x-ssid"] || "").trim();
  if (ssid) {
    req.devSsid = ssid.slice(0, 2000);
    next();
    return;
  }
  res.status(401).json({ error: "missing bearer token or x-ssid", code: "AUTH_REQUIRED" });
}
