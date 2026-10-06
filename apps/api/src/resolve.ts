import { createHash } from "crypto";
import type { Request } from "express";
import { cookieReauth } from "./riot/auth";
import { getGeo } from "./riot/geo";
import { enc } from "./persist/crypto";
import { primeSession } from "./session";
import { fixtureGeo } from "./fixture";
import type { CookieJar, RiotAccountDoc, RiotTokens, UserDoc } from "./types";
import type { Repo } from "./persist/repo";

export interface Resolved {
  user: UserDoc;
  account: RiotAccountDoc | null;
  jarOverride?: CookieJar;
}

/* Dev-path reauth results, cached by ssid hash so we don't reauth on every
   request. The session cache (session.ts) still owns token freshness. */
const devCache = new Map<string, { tokens: RiotTokens; jar: CookieJar }>();
const hashSsid = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

/* Resolve the acting user + riot account for a request.
   - JWT: the user row (upserted by userId) and their active (or first) account.
   - x-ssid dev path: a single "dev" user; the jar from the header is reauthed
     (or fixture-short-circuited), the account is upserted by (dev, puuid), and
     rotation is persisted into that account's jar. Full reauth+rotation. */
export async function resolveAccount(req: Request, repo: Repo): Promise<Resolved> {
  if (req.user) {
    const user = await repo.upsertUserByGoogleId(req.user.id, { email: req.user.email });
    const accounts = await repo.getAccountsByUser(user.id);
    const account =
      accounts.find((a) => a.id === user.activeRiotAccountId) || accounts[0] || null;
    return { user, account };
  }

  const ssid = req.devSsid || "";
  const user = await repo.upsertUserByGoogleId("dev", { email: "dev@localhost", name: "dev" });
  const h = hashSsid(ssid);
  let dc = devCache.get(h);
  if (!dc || dc.tokens.expiresAt <= Date.now()) {
    const { tokens, jar } = await cookieReauth({ ssid });
    dc = { tokens, jar };
    devCache.set(h, dc);
    if (devCache.size > 50) {
      const first = devCache.keys().next().value as string | undefined;
      if (first) devCache.delete(first);
    }
  }
  const tokens = dc.tokens;
  let account = await repo.upsertAccount(user.id, tokens.puuid, {
    gameName: tokens.gameName,
    tagLine: tokens.tagLine,
    region: tokens.fixture ? fixtureGeo().region : "",
    shard: tokens.fixture ? fixtureGeo().shard : "",
    encryptedCookies: enc(JSON.stringify(dc.jar)),
  });
  if (!tokens.fixture && !account.region) {
    const g = await getGeo(tokens.accessToken, tokens.idToken);
    await repo.updateAccount(account.id, { region: g.region, shard: g.shard });
    account = { ...account, region: g.region, shard: g.shard };
  }
  // the reauth above is authoritative — prime the session cache with it
  primeSession(user.id, tokens.puuid, tokens);
  return { user, account, jarOverride: dc.jar };
}
