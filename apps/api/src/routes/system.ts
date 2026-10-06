import { Router } from "express";
import { ah } from "../http";
import { authUser } from "../auth";
import { config } from "../config";
import type { Repo } from "../persist/repo";

export function systemRoutes(repo: Repo): Router {
  const r = Router();

  r.get("/health", (_req, res) => {
    res.json({ ok: true, version: config.version });
  });

  r.get("/me", authUser, ah(async (req, res) => {
    const user = await repo.upsertUserByGoogleId(req.user!.id, { email: req.user!.email });
    const accounts = await repo.getAccountsByUser(user.id);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, image: user.image },
      accounts: accounts.map((a) => ({
        id: a.id,
        gameName: a.gameName,
        tagLine: a.tagLine,
        region: a.region,
        shard: a.shard,
        active: a.id === user.activeRiotAccountId,
      })),
    });
  }));

  return r;
}
