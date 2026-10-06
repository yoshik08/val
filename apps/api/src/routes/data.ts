import { Router } from "express";
import { ah } from "../http";
import { authFlexible } from "../auth";
import { resolveAccount } from "../resolve";
import { sessionKey, withRiot } from "../session";
import { cached } from "../data-cache";
import { getMatch, getStorefront, getWallet } from "../riot/client";
import { fixtureMatch, fixtureStore, fixtureWallet } from "../fixture";
import type { Repo } from "../persist/repo";

export function dataRoutes(repo: Repo): Router {
  const r = Router();
  r.use(authFlexible);

  r.get("/status", ah(async (req, res) => {
    const { account } = await resolveAccount(req, repo);
    if (!account) {
      res.json({ connected: false });
      return;
    }
    res.json({
      connected: true,
      gameName: account.gameName,
      tagLine: account.tagLine,
      region: account.region,
      shard: account.shard,
      accountId: account.id,
    });
  }));

  r.get("/store", ah(async (req, res) => {
    const { account, jarOverride } = await resolveAccount(req, repo);
    if (!account) {
      res.status(401).json({ error: "not connected", code: "NOT_CONNECTED" });
      return;
    }
    const data = await cached("store", sessionKey(account.userId, account.puuid), () =>
      withRiot(
        repo,
        account,
        async (t) => (t.fixture ? fixtureStore() : getStorefront(t, account.shard)),
        jarOverride
      )
    );
    res.json(data);
  }));

  r.get("/wallet", ah(async (req, res) => {
    const { account, jarOverride } = await resolveAccount(req, repo);
    if (!account) {
      res.status(401).json({ error: "not connected", code: "NOT_CONNECTED" });
      return;
    }
    const data = await cached("wallet", sessionKey(account.userId, account.puuid), () =>
      withRiot(
        repo,
        account,
        async (t) => (t.fixture ? fixtureWallet() : getWallet(t, account.shard)),
        jarOverride
      )
    );
    res.json(data);
  }));

  r.get("/match", ah(async (req, res) => {
    const { account, jarOverride } = await resolveAccount(req, repo);
    if (!account) {
      res.status(401).json({ error: "not connected", code: "NOT_CONNECTED" });
      return;
    }
    const data = await cached("match", sessionKey(account.userId, account.puuid), () =>
      withRiot(
        repo,
        account,
        async (t) => (t.fixture ? fixtureMatch() : getMatch(t, account.shard, account.region)),
        jarOverride
      )
    );
    res.json(data);
  }));

  return r;
}
