import { SignJWT } from "jose";

/**
 * Mint a short-lived HMAC JWT for the backend API (HS256, 15 min).
 * Server-only: API_JWT_SECRET must never reach the client bundle.
 */
export async function mintApiToken(opts: {
  userId: string;
  email?: string | null;
}): Promise<string> {
  const secret = process.env.API_JWT_SECRET;
  if (!secret) {
    throw new Error("API_JWT_SECRET is not configured");
  }
  return await new SignJWT({ userId: opts.userId, email: opts.email ?? undefined })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(secret));
}
