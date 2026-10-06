import "server-only";
import { auth } from "./auth";
import { mintApiToken } from "./jwt";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isExpiredError(e: unknown): boolean {
  if (e instanceof ApiError) {
    return e.status === 401 || e.code === "SSID_EXPIRED";
  }
  return false;
}

/**
 * Server-only API client. Mints a short-lived HMAC JWT from the
 * Auth.js session and attaches it as `Authorization: Bearer`.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: { method?: string; json?: unknown } = {}
): Promise<T> {
  const session = await auth();
  // never mint a token without a real session — anonymous callers must 401,
  // otherwise every signed-out visitor would share one "unknown" user bucket.
  if (!session?.user?.id) {
    throw new ApiError("not signed in", 401, "NOT_SIGNED_IN");
  }
  const token = await mintApiToken({
    userId: session.user.id,
    email: session.user.email,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "api unreachable — the backend may be cold-starting, retry in a few seconds",
      0
    );
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-json body */
  }

  if (!res.ok) {
    const err =
      (data as { error?: string; code?: string } | null) ?? {};
    throw new ApiError(
      err.error ?? `request failed: ${res.status}`,
      res.status,
      err.code
    );
  }
  return data as T;
}
