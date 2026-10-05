const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { getDb } = require("./lib/db");
const { enc, dec } = require("./lib/crypto");
const riot = require("./lib/riot");
const val = require("./lib/val");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));
app.use(express.json({ limit: "100kb" }));

const str = (v, n) => (typeof v === "string" ? v.slice(0, n || 500) : "");
const coll = async () => (await getDb()).collection("auth");
const MFA_TTL = 5 * 60 * 1000;

/* ---------- token management ---------- */
async function getTokens() {
  const doc = await (await coll()).findOne({ _id: "riot" });
  if (!doc) return null;
  const t = doc.tokens;
  if (!t || !t.accessToken) return null;
  if (t.expiresAt && t.expiresAt < Date.now()) {
    // re-auth silently with stored creds
    try {
      const creds = JSON.parse(dec(doc.creds));
      const r = await riot.login(creds.u, creds.p);
      if (r.mfa) return { mfaExpired: true };
      await (await coll()).updateOne({ _id: "riot" }, { $set: { tokens: r.tokens, updatedAt: new Date() } });
      return r.tokens;
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
  if (t.mfaExpired) { const e = new Error("session expired, reconnect"); e.code = 401; throw e; }
  try {
    return await fn(t);
  } catch (e) {
    if (e.code === "TOKEN_EXPIRED") {
      // force refresh and retry once
      await (await coll()).updateOne({ _id: "riot" }, { $set: { "tokens.expiresAt": 0 } });
      t = await getTokens();
      if (!t || t.mfaExpired) { const er = new Error("session expired"); er.code = 401; throw er; }
      return await fn(t);
    }
    throw e;
  }
}

/* ---------- routes ---------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/connect", async (req, res) => {
  try {
    const username = str(req.body.username, 200);
    const password = str(req.body.password, 500);
    if (!username || !password) return res.status(400).json({ error: "username and password required" });
    const r = await riot.login(username, password);
    if (r.mfa) {
      const mfaId = crypto.randomBytes(16).toString("hex");
      await (await coll()).updateOne(
        { _id: "mfa:" + mfaId },
        { $set: { cookies: r.cookies, creds: enc(JSON.stringify({ u: username, p: password })), createdAt: new Date() } },
        { upsert: true }
      );
      // cleanup old mfa sessions
      await (await coll()).deleteMany({ _id: /^mfa:/, createdAt: { $lt: new Date(Date.now() - MFA_TTL) } });
      return res.json({ mfa: true, mfaId });
    }
    await (await coll()).updateOne(
      { _id: "riot" },
      { $set: { creds: enc(JSON.stringify({ u: username, p: password })), tokens: r.tokens, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true, gameName: r.tokens.gameName, tagLine: r.tokens.tagLine });
  } catch (e) {
    console.log("connect failed:", e.message);
    res.status(401).json({ error: e.message.includes("auth_failure") ? "invalid username or password" : e.message.slice(0, 160) });
  }
});

app.post("/api/connect/mfa", async (req, res) => {
  try {
    const mfaId = str(req.body.mfaId, 64);
    const code = str(req.body.code, 20);
    if (!mfaId || !code) return res.status(400).json({ error: "mfaId and code required" });
    const doc = await (await coll()).findOne({ _id: "mfa:" + mfaId });
    if (!doc) return res.status(400).json({ error: "mfa session expired, try again" });
    const r = await riot.submitMfa(doc.cookies, code);
    await (await coll()).updateOne(
      { _id: "riot" },
      { $set: { creds: doc.creds, tokens: r.tokens, updatedAt: new Date() } },
      { upsert: true }
    );
    await (await coll()).deleteOne({ _id: "mfa:" + mfaId });
    res.json({ ok: true, gameName: r.tokens.gameName, tagLine: r.tokens.tagLine });
  } catch (e) {
    console.log("mfa failed:", e.message);
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
