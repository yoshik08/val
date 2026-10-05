const express = require("express");
const cors = require("cors");
const path = require("path");
const { getDb } = require("./lib/db");
const { enc, dec } = require("./lib/crypto");
const riot = require("./lib/riot");
const val = require("./lib/val");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));
app.use(express.json({ limit: "100kb" }));

// local-only mode: serve the frontend from the backend (single process)
const LOCAL_MODE = !process.env.MONGODB_URI;
if (LOCAL_MODE) {
  app.use("/val", express.static(path.join(__dirname, "..")));
  app.get("/val", (req, res) => res.sendFile(path.join(__dirname, "..", "index.html")));
}

const str = (v, n) => (typeof v === "string" ? v.slice(0, n || 500) : "");
const coll = async () => (await getDb()).collection("auth");

/* ---------- token management ---------- */
async function getTokens() {
  const doc = await (await coll()).findOne({ _id: "riot" });
  if (!doc) return null;
  const t = doc.tokens;
  if (!t || !t.accessToken) return null;
  if (t.expiresAt && t.expiresAt < Date.now()) {
    // re-auth silently with stored ssid cookie
    try {
      const ssid = dec(doc.ssid);
      const tokens = await riot.cookieReauth(ssid);
      await (await coll()).updateOne({ _id: "riot" }, { $set: { tokens, updatedAt: new Date() } });
      return tokens;
    } catch (e) {
      console.log("re-auth failed:", e.message);
      return null;
    }
  }
  return t;
}

async function withTokens(fn) {
  let t = await getTokens();
  if (!t) { const e = new Error("not connected"); e.code = 401; throw e; }
  
  try {
    return await fn(t);
  } catch (e) {
    if (e.code === "TOKEN_EXPIRED") {
      // force refresh and retry once
      await (await coll()).updateOne({ _id: "riot" }, { $set: { "tokens.expiresAt": 0 } });
      t = await getTokens();
      if (!t) { const er = new Error("session expired"); er.code = 401; throw er; }
      return await fn(t);
    }
    throw e;
  }
}

/* ---------- routes ---------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/connect", async (req, res) => {
  try {
    const ssid = str(req.body.ssid, 2000).trim();
    if (!ssid) return res.status(400).json({ error: "ssid cookie required" });
    const tokens = await riot.cookieReauth(ssid);
    await (await coll()).updateOne(
      { _id: "riot" },
      { $set: { ssid: enc(ssid), tokens, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true, gameName: tokens.gameName, tagLine: tokens.tagLine });
  } catch (e) {
    console.log("connect failed:", e.message);
    res.status(401).json({ error: e.message.slice(0, 160) });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const t = await getTokens();
    if (!t) return res.json({ connected: false });
    res.json({ connected: true, gameName: t.gameName, tagLine: t.tagLine });
  } catch (e) { res.json({ connected: false }); }
});

app.post("/api/disconnect", async (req, res) => {
  await (await coll()).deleteOne({ _id: "riot" });
  res.json({ ok: true });
});

let shopCache = null;
app.get("/api/shop", async (req, res) => {
  try {
    if (shopCache && Date.now() - shopCache.at < 5 * 60 * 1000) return res.json(shopCache.data);
    const data = await withTokens((t) => val.getShop(t));
    shopCache = { at: Date.now(), data };
    res.json(data);
  } catch (e) {
    res.status(e.code || 500).json({ error: e.message.slice(0, 200) });
  }
});

let matchCache = null;
app.get("/api/match", async (req, res) => {
  try {
    if (matchCache && Date.now() - matchCache.at < 30 * 1000) return res.json(matchCache.data);
    const data = await withTokens((t) => val.getMatch(t));
    matchCache = { at: Date.now(), data };
    res.json(data);
  } catch (e) {
    res.status(e.code || 500).json({ error: e.message.slice(0, 200) });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("val api on :" + PORT));
