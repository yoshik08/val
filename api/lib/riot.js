/* riot client-auth flow for valorant.
   init -> PUT username/password -> access_token (+ MFA if needed)
   -> entitlements token -> userinfo (puuid) */
const AUTH_URL = "https://auth.riotgames.com/api/v1/authorization";
const ENT_URL = "https://entitlements.auth.riotgames.com/api/token/v1";
const USERINFO_URL = "https://auth.riotgames.com/userinfo";
const UA = "RiotClient/58.0.0.4640299.4552318 rso-auth (Windows;10;;Professional, x64)";

function parseCookies(setCookies) {
  const out = {};
  for (const c of setCookies || []) {
    const pair = c.split(";")[0];
    const i = pair.indexOf("=");
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return out;
}

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
  const newCookies = { ...(cookies || {}), ...parseCookies(
    typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : []
  ) };
  // fallback for environments without getSetCookie
  const sc = r.headers.get("set-cookie");
  if (sc && typeof r.headers.getSetCookie !== "function") Object.assign(newCookies, parseCookies([sc]));
  return { status: r.status, data, cookies: newCookies };
}

async function initAuth() {
  const { status, data, cookies } = await req("POST", AUTH_URL, {
    client_id: "play-valorant-web-prod",
    nonce: "1",
    redirect_uri: "https://playvalorant.com/opt_in",
    response_type: "token id_token",
    scope: "account openid",
  });
  if (status !== 200) throw new Error("riot auth init failed: " + status);
  return cookies;
}

function extractToken(uri) {
  const frag = (uri.split("#")[1] || "");
  const params = new URLSearchParams(frag);
  return {
    accessToken: params.get("access_token"),
    idToken: params.get("id_token"),
    expiresIn: parseInt(params.get("expires_in") || "3600", 10),
  };
}

/* returns { tokens } | { mfa: true, cookies } ; throws on bad creds */
async function login(username, password, cookies) {
  cookies = cookies || (await initAuth());
  const { status, data, cookies: ck } = await req("PUT", AUTH_URL, {
    type: "auth", username, password, remember: true,
  }, cookies);
  const t = data && data.type;
  if (t === "multifactor") return { mfa: true, cookies: ck, methods: data.multifactor };
  if (t === "response") {
    const { accessToken, idToken, expiresIn } = extractToken(data.response.parameters.uri);
    if (!accessToken) throw new Error("no access token in riot response");
    return { tokens: await finishAuth(accessToken, idToken, expiresIn) };
  }
  const err = (data && (data.error || JSON.stringify(data)).slice(0, 120)) || ("http " + status);
  throw new Error("riot login failed: " + err);
}

async function submitMfa(cookies, code) {
  const { status, data } = await req("PUT", AUTH_URL, { type: "multifactor", code: String(code).trim(), remember: true }, cookies);
  if (data && data.type === "response") {
    const { accessToken, idToken, expiresIn } = extractToken(data.response.parameters.uri);
    if (!accessToken) throw new Error("no access token after mfa");
    return { tokens: await finishAuth(accessToken, idToken, expiresIn) };
  }
  const err = (data && (data.error || JSON.stringify(data)).slice(0, 120)) || ("http " + status);
  throw new Error("mfa failed: " + err);
}

async function finishAuth(accessToken, idToken, expiresIn) {
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
    accessToken, idToken, entitlements: ent, puuid,
    gameName: acct.game_name || "", tagLine: acct.tag_line || "",
    expiresAt: Date.now() + (expiresIn || 3600) * 1000 - 60000,
  };
}

module.exports = { login, submitMfa, initAuth };
