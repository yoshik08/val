import { RiotError } from "./errors";
import { riotFetch }from "./fetch";
import type { CookieJar, RiotTokens } from "../types";
import { fixtureTokens, FIXTURE_SSID } from "../fixture";
import { config } from "../config";

export const RIOT_UA =
  "RiotClient/58.0.0.4640299.4552318 rso-auth (Windows;10;;Professional, x64)";

const AUTHORIZE = "https://auth.riotgames.com/authorize";
const ENTITLEMENTS = "https://entitlements.auth.riotgames.com/api/token/v1";
const USERINFO = "https://auth.riotgames.com/userinfo";

export function jarToHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/* crude splitter for the single-string set-cookie case (undici exposes
   getSetCookie(); this is only the fallback). */
function splitSetCookieHeader(single: string): string[] {
  const out: string[] = [];
  let cur = "";
  const parts = single.split(",");
  for (const p of parts) {
    if (/^\s*[A-Za-z0-9_-]+=\s*/.test(p) && cur) {
      out.push(cur);
      cur = p;
    } else {
      cur += (cur ? "," : "") + p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* Parse ALL Set-Cookie headers and merge them into the jar. Rotation-safe:
   every cookie riot sets (esp. a rotated ssid) lands back in the jar. */
export function mergeSetCookies(jar: CookieJar, res: Response): CookieJar {
  const out: CookieJar = { ...jar };
  let raw: string[] = [];
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") {
    raw = h.getSetCookie();
  } else {
    const single = res.headers.get("set-cookie");
    if (single) raw = splitSetCookieHeader(single);
  }
  for (const sc of raw) {
    const semi = sc.indexOf(";");
    const pair = (semi >= 0 ? sc.slice(0, semi) : sc).trim();
    const eq = pair.indexOf("=");
    if (eq > 0) {
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) out[name] = value;
    }
  }
  return out;
}

/* Cookie reauth: GET /authorize with the full jar, redirect:'manual'.
   Returns fresh tokens plus the jar with ALL rotated cookies merged in. */
export async function cookieReauth(jar: CookieJar): Promise<{ tokens: RiotTokens; jar: CookieJar }> {
  if (config.fixture && jar["ssid"] === FIXTURE_SSID) {
    return { tokens: fixtureTokens(), jar: { ...jar } };
  }
  const qs =
    `redirect_uri=${encodeURIComponent("https://playvalorant.com/opt_in")}` +
    `&client_id=play-valorant-web-prod` +
    `&response_type=${encodeURIComponent("token id_token")}` +
    `&nonce=1&scope=${encodeURIComponent("account openid")}`;
  const res = await riotFetch(`${AUTHORIZE}?${qs}`, {
    method: "GET",
    headers: { "User-Agent": RIOT_UA, Cookie: jarToHeader(jar) },
    redirect: "manual",
  });
  const loc = res.headers.get("location") || "";
  if (/authenticate\.riotgames\.com\/login/i.test(loc)) {
    throw new RiotError(
      "ssid expired — log into riot in your browser and paste a fresh ssid",
      "SSID_EXPIRED",
      401
    );
  }
  const frag = loc.split("#")[1] || "";
  const fp = new URLSearchParams(frag);
  const accessToken = fp.get("access_token") || "";
  const idToken = fp.get("id_token") || "";
  if (!accessToken) {
    throw new RiotError(
      "ssid expired or invalid — log into riot in your browser and paste a fresh ssid",
      "SSID_EXPIRED",
      401
    );
  }
  const expiresIn = parseInt(fp.get("expires_in") || "3600", 10) || 3600;
  const rotated = mergeSetCookies(jar, res);

  const ent = await riotFetch(ENTITLEMENTS, {
    method: "POST",
    headers: {
      "User-Agent": RIOT_UA,
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: "{}",
  });
  const entJson = (await ent.json().catch(() => null)) as { entitlements_token?: string } | null;
  const entitlements = entJson && entJson.entitlements_token;
  if (!entitlements) throw new RiotError("entitlements request failed", "ENTITLEMENTS_FAILED");

  const u = await riotFetch(USERINFO, {
    headers: { "User-Agent": RIOT_UA, Authorization: `Bearer ${accessToken}` },
  });
  const uj = (await u.json().catch(() => null)) as {
    sub?: string;
    acct?: { game_name?: string; tag_line?: string };
    gameName?: string;
    tagLine?: string;
  } | null;
  const puuid = uj && uj.sub;
  if (!puuid) throw new RiotError("userinfo request failed", "USERINFO_FAILED");
  const acct = (uj && uj.acct) || {};

  const tokens: RiotTokens = {
    accessToken,
    idToken,
    entitlements,
    puuid,
    gameName: acct.game_name || uj.gameName || "",
    tagLine: acct.tag_line || uj.tagLine || "",
    expiresAt: Date.now() + expiresIn * 1000 - 60000,
  };
  return { tokens, jar: rotated };
}
