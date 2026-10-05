const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const riot = require("./lib/riot");
const val = require("./lib/val");

const app = express();
// allow both the main domain and the val subdomain
const corsOrigins = (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [])
  .concat(["https://yoshik.xyz", "https://val.yoshik.xyz"])
  .map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: [...new Set(corsOrigins)], exposedHeaders: ["x-new-ssid"] }));
app.use(express.json({ limit: "100kb" }));

// local-only mode: serve the frontend from the backend (single process)
const LOCAL_MODE = !process.env.MONGODB_URI;
if (LOCAL_MODE) {
  app.use("/val", express.static(path.join(__dirname, "..")));
  app.get("/val", (req, res) => res.sendFile(path.join(__dirname, "..", "index.html")));
}

const str = (v, n) => (typeof v === "string" ? v.slice(0, n || 2000) : "");

/* ---------- token management (in-memory only, nothing persisted) ---------- */
// cache tokens per ssid so we don't re-auth on every request
const tokenCache = new Map(); // hash(ssid) -> { tokens, ssid }
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

async function getTokens(ssid) {
  ssid = str(ssid, 2000).trim();
  if (!ssid) { const e = new Error("not connected"); e.code = 401; throw e; }
  const h = hash(ssid);
  const cached = tokenCache.get(h);
  if (cached && cached.tokens.expiresAt && cached.tokens.expiresAt > Date.now()) {
    return cached.tokens;
  }
  // (re)auth with the ssid cookie — never stored
  const tokens = await riot.cookieReauth(ssid);
  tokenCache.set(h, { tokens });
  // prune old entries
  if (tokenCache.size > 50) {
    const first = tokenCache.keys().next().value;
    tokenCache.delete(first);
  }
  return tokens;
}

const ssidOf = (req) => str(req.headers["x-ssid"] || "", 2000).trim();

async function withTokens(req, res, fn) {
  const ssid = ssidOf(req);
  let t;
  try {
    t = await getTokens(ssid);
  } catch (e) {
    const er = new Error(e.message || "not connected");
    er.code = 401;
    throw er;
  }
  // if riot rotated the ssid, tell the client to save the new one
  if (t.newSsid && res) {
    res.setHeader("x-new-ssid", t.newSsid);
    // update cache key so future requests use the fresh ssid
    tokenCache.delete(hash(ssid));
    tokenCache.set(hash(t.newSsid), { tokens: t });
  }
  try {
    return await fn(t);
  } catch (e) {
    if (e.code === "TOKEN_EXPIRED") {
      tokenCache.delete(hash(ssid));
      t = await getTokens(ssid);
      if (t.newSsid && res) res.setHeader("x-new-ssid", t.newSsid);
      return await fn(t);
    }
    throw e;
  }
}

/* ---------- routes ---------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

// validate an ssid without storing anything
app.post("/api/connect", async (req, res) => {
  try {
    const ssid = str(req.body.ssid, 2000).trim() || ssidOf(req);
    if (!ssid) return res.status(400).json({ error: "ssid cookie required" });
    const tokens = await riot.cookieReauth(ssid);
    tokenCache.set(hash(ssid), { tokens });
    res.json({ ok: true, gameName: tokens.gameName, tagLine: tokens.tagLine });
  } catch (e) {
    res.status(401).json({ error: (e.message || "auth failed").slice(0, 160) });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const t = await getTokens(ssidOf(req));
    res.json({ connected: true, gameName: t.gameName, tagLine: t.tagLine });
  } catch (e) { res.json({ connected: false }); }
});

// per-ssid shop cache (5 min) — memory only
const shopCache = new Map();
app.get("/api/shop", async (req, res) => {
  try {
    const h = hash(ssidOf(req));
    const c = shopCache.get(h);
    if (c && Date.now() - c.at < 5 * 60 * 1000) return res.json(c.data);
    const data = await withTokens(req, res, (t) => val.getShop(t));
    shopCache.set(h, { at: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(e.code || 500).json({ error: (e.message || "failed").slice(0, 200) });
  }
});

// per-ssid match cache (30 sec) — memory only
const matchCache = new Map();
app.get("/api/match", async (req, res) => {
  try {
    const h = hash(ssidOf(req));
    const c = matchCache.get(h);
    if (c && Date.now() - c.at < 30 * 1000) return res.json(c.data);
    const data = await withTokens(req, res, (t) => val.getMatch(t));
    matchCache.set(h, { at: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(e.code || 500).json({ error: (e.message || "failed").slice(0, 200) });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("val api on :" + PORT + (LOCAL_MODE ? " (local mode)" : "")));
