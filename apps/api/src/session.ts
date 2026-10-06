import { cookieReauth } from "./riot/auth";
import { RiotError } from "./riot/errors";
import { dec, enc } from "./persist/crypto";
import type { CookieJar, RiotAccountDoc, RiotTokens } from "./types";
import type { Repo } from "./persist/repo";

/* Per-account session cache. This is the fix for the "only one user's ssid
   works" bug: the cache key is userId+puuid, cookie jars live per account,
   and Set-Cookie rotation is merged into THAT account's jar only.
   There is deliberately no global/single-user cache anywhere. */

interface Entry {
  tokens: RiotTokens;
  expiresAt: number;
}

const cache = new Map<string, Entry>();
const MAX_ENTRIES = 200;

export const sessionKey = (userId: string, puuid: string): string => `${userId}:${puuid}`;

function set(key: string, tokens: RiotTokens): void {
  cache.set(key, { tokens, expiresAt: tokens.expiresAt });
  if (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value as string | undefined;
    if (first) cache.delete(first);
  }
}

/** Prime the cache after an already-completed reauth (dev path). */
export function primeSession(userId: string, puuid: string, tokens: RiotTokens): void {
  set(sessionKey(userId, puuid), tokens);
}

export function clearSession(userId: string, puuid: string): void {
  cache.delete(sessionKey(userId, puuid));
}

export function clearUserSessions(userId: string): void {
  for (const k of [...cache.keys()]) {
    if (k.startsWith(userId + ":")) cache.delete(k);
  }
}

/* Fresh tokens for one account. Reauths through that account's own jar when
   the cached tokens are missing/expired, and persists the rotated jar back
   into the same account's encryptedCookies. */
export async function getSession(
  repo: Repo,
  account: RiotAccountDoc,
  jarOverride?: CookieJar
): Promise<RiotTokens> {
  const k = sessionKey(account.userId, account.puuid);
  const c = cache.get(k);
  if (c && c.expiresAt > Date.now()) return c.tokens;
  const jar: CookieJar = jarOverride ?? (JSON.parse(dec(account.encryptedCookies)) as CookieJar);
  try {
    const { tokens, jar: rotated } = await cookieReauth(jar);
    await repo.updateAccount(account.id, {
      encryptedCookies: enc(JSON.stringify(rotated)),
      lastReauthAt: Date.now(),
      lastError: "",
    });
    set(k, tokens);
    return tokens;
  } catch (e) {
    if (e instanceof RiotError) {
      await repo.updateAccount(account.id, { lastError: e.message }).catch(() => undefined);
    }
    throw e;
  }
}

/* Run fn with fresh tokens; on TOKEN_EXPIRED (401 from riot) drop the cache
   entry and reauth exactly once. */
export async function withRiot<T>(
  repo: Repo,
  account: RiotAccountDoc,
  fn: (t: RiotTokens) => Promise<T>,
  jarOverride?: CookieJar
): Promise<T> {
  let tokens = await getSession(repo, account, jarOverride);
  try {
    return await fn(tokens);
  } catch (e) {
    if (e instanceof RiotError && e.code === "TOKEN_EXPIRED") {
      clearSession(account.userId, account.puuid);
      tokens = await getSession(repo, account, jarOverride);
      return await fn(tokens);
    }
    throw e;
  }
}
