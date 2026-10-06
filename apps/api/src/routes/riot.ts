import { Router } from "express";
import { ah } from "../http";
import { authUser } from "../auth";
import { cookieReauth } from "../riot/auth";
import { getGeo } from "../riot/geo";
import { enc } from "../persist/crypto";
import { clearUserSessions } from "../session";
import { fixtureGeo } from "../fixture";
import type { CookieJar } from "../types";
import type { Repo } from "../persist/repo";

const publicAccount = (a: { id: string; gameName: string; tagLine: string; region: string; shard: string }) => ({
  id: a.id,
  gameName: a.gameName,
  tagLine: a.tagLine,
  region: a.region,
  shard: a.shard,
});

export function riotRoutes(repo: Repo): Router {
  const r = Router();
  r.use(authUser);

  /* Connect (or re-validate) a riot account: reauth the jar, discover
     geo/shard, upsert the account, persist the rotated jar encrypted. */
  r.post("/connect", ah(async (req, res) => {
    const user = await repo.upsertUserByGoogleId(req.user!.id, { email: req.user!.email });
    const body = (req.body || {}) as { ssid?: unknown; cookies?: unknown };
    let jar: CookieJar = {};
    if (body.cookies && typeof body.cookies === "object") {
      for (const [k, v] of Object.entries(body.cookies as Record<string, unknown>)) {
        if (typeof v === "string") jar[k] = v.slice(0, 4000);
      }
    } else if (typeof body.ssid === "string" && body.ssid.trim()) {
      jar = { ssid: body.ssid.trim().slice(0, 2000) };
    }
    if (!Object.keys(jar).length) {
      res.status(400).json({ error: "ssid or cookies required" });
      return;
    }
    const { tokens, jar: rotated } = await cookieReauth(jar);
    const geo = tokens.fixture ? fixtureGeo() : await getGeo(tokens.accessToken, tokens.idToken);
    const account = await repo.upsertAccount(user.id, tokens.puuid, {
      gameName: tokens.gameName,
      tagLine: tokens.tagLine,
      region: geo.region,
      shard: geo.shard,
      encryptedCookies: enc(JSON.stringify(rotated)),
    });
    await repo.setActiveAccount(user.id, account.id);
    res.json({ ok: true, account: publicAccount(account) });
  }));

  /* Disconnect: drop all of this user's riot accounts and their sessions. */
  r.delete("/disconnect", ah(async (req, res) => {
    const user = await repo.upsertUserByGoogleId(req.user!.id, { email: req.user!.email });
    await repo.deleteAccountsByUser(user.id);
    await repo.setActiveAccount(user.id, null);
    clearUserSessions(user.id);
    res.json({ ok: true });
  }));

  /* Switch the active riot account. */
  r.post("/switch", ah(async (req, res) => {
    const user = await repo.upsertUserByGoogleId(req.user!.id, { email: req.user!.email });
    const accountId = String((req.body || {}).accountId || "");
    const account = accountId ? await repo.getAccountById(accountId) : null;
    if (!account || account.userId !== user.id) {
      res.status(404).json({ error: "account not found", code: "NOT_FOUND" });
      return;
    }
    await repo.setActiveAccount(user.id, account.id);
    res.json({ ok: true, account: publicAccount(account) });
  }));

  return r;
}
