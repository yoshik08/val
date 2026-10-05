/* riot auth via ssid cookie (cookie reauth).
   riot now requires hcaptcha on the password endpoint, so direct
   username/password login from a server is dead. instead the user logs
   in once in their own browser, pastes the `ssid` cookie, and we refresh
   tokens with it: GET /authorize + ssid cookie -> 301 redirect with
   access_token in the fragment. */
const AUTHORIZE_URL = "https://auth.riotgames.com/authorize";
const ENT_URL = "https://entitlements.auth.riotgames.com/api/token/v1";
const USERINFO_URL = "https://auth.riotgames.com/userinfo";
const UA = "RiotClient/58.0.0.4640299.4552318 rso-auth (Windows;10;;Professional, x64)";

async function req(method, url, body, cookies, extraHeaders) {
  const headers = { "User-Agent": UA, "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (cookies && Object.keys(cookies).length) {
    headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const r = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* ignore */ }
  return { status: r.status, data };
}

/* returns fresh tokens from a riot ssid cookie; throws if expired/invalid */
async function cookieReauth(ssid) {
  const params = new URLSearchParams({
    client_id: "play-valorant-web-prod",
    nonce: "1",
    redirect_uri: "https://playvalorant.com/opt_in",
    response_type: "token id_token",
    scope: "account openid",
  });
  const r = await fetch(`${AUTHORIZE_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "User-Agent": UA, "Cookie": `ssid=${ssid}` },
    redirect: "manual",
  });
  const loc = r.headers.get("location") || "";
  const frag = loc.split("#")[1] || "";
  const fp = new URLSearchParams(frag);
  const accessToken = fp.get("access_token");
  if (!accessToken) throw new Error("ssid expired or invalid — log into riot in your browser and paste a fresh one");
  const expiresIn = parseInt(fp.get("expires_in") || "3600", 10);
  return finishAuth(accessToken, expiresIn);
}

async function finishAuth(accessToken, expiresIn) {
  // entitlements
  const e = await req("POST", ENT_URL, {}, null, { Authorization: `Bearer ${accessToken}` });
  const ent = e.data && e.data.entitlements_token;
  if (!ent) throw new Error("entitlements failed");
  // userinfo -> puuid + riot id
  const u = await req("GET", USERINFO_URL, undefined, null, { Authorization: `Bearer ${accessToken}` });
  const puuid = u.data && u.data.sub;
  if (!puuid) throw new Error("userinfo failed");
  const acct = (u.data && u.data.acct) || {};
  return {
    accessToken, entitlements: ent, puuid,
    gameName: acct.game_name || "", tagLine: acct.tag_line || "",
    expiresAt: Date.now() + (expiresIn || 3600) * 1000 - 60000,
  };
}

module.exports = { cookieReauth };
