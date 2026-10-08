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

/* Fresh tokens for one account. Order of resolution:
   1. in-memory cache (fast path)
   2. Mongo-persisted encrypted tokens (survives cold starts / restarts)
   3. full cookieReauth through the account's jar (slow Riot chain), then
      persist the rotated jar AND the fresh tokens back into the account doc.
   expiresAt already carries the 5-min early-refresh buffer, so a stored token
   that passes the Date.now() check is safe to use immediately. */
export async function getSession(
  repo: Repo,
  account: RiotAccountDoc,
  jarOverride?: CookieJar
): Promise<RiotTokens> {
  const k = sessionKey(account.userId, account.puuid);
  const c = cache.get(k);
  if (c && c.expiresAt > Date.now()) return c.tokens;
  if (!jarOverride && account.encryptedTokens) {
    try {
      const stored = JSON.parse(dec(account.encryptedTokens)) as RiotTokens;
      if (stored && stored.expiresAt > Date.now()) {
        set(k, stored);
        return stored;
      }
    } catch {
      /* corrupted payload — fall through to reauth */
    }
  }
  const jar: CookieJar = jarOverride ?? (JSON.parse(dec(account.encryptedCookies)) as CookieJar);
  try {
    const { tokens, jar: rotated } = await cookieReauth(jar);
    await repo.updateAccount(account.id, {
      encryptedCookies: enc(JSON.stringify(rotated)),
      encryptedTokens: enc(JSON.stringify(tokens)),
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
