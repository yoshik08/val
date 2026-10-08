import { Router } from "express";
import { ah } from "../http";
import { config } from "../config";
import { clearSession, getSession } from "../session";
import { dec } from "../persist/crypto";
import type { RiotTokens } from "../types";
import type { Repo } from "../persist/repo";

/* Refresh any account whose persisted tokens are missing or expire within
   this window, so page loads never pay the Riot reauth chain. Hit by the
   scheduled token-refresh cron, guarded by INTERNAL_SECRET. One account's
   dead SSID never blocks the others. */
const REFRESH_WITHIN_MS = 40 * 60 * 1000;

export function internalRoutes(repo: Repo): Router {
  const r = Router();

  r.post("/internal/refresh-tokens", ah(async (req, res) => {
    if (!config.internalSecret || req.headers["x-internal-secret"] !== config.internalSecret) {
      res.status(403).json({ error: "forbidden", code: "FORBIDDEN" });
      return;
    }
    const accounts = await repo.getAllAccounts();
    const results: Array<{ accountId: string; refreshed: boolean; error?: string }> = [];
    for (const a of accounts) {
      try {
        let stored: RiotTokens | null = null;
        if (a.encryptedTokens) {
          try {
            stored = JSON.parse(dec(a.encryptedTokens)) as RiotTokens;
          } catch {
            stored = null;
          }
        }
        if (!stored || stored.expiresAt - Date.now() < REFRESH_WITHIN_MS) {
          clearSession(a.userId, a.puuid);
          const fresh = (await repo.getAccountById(a.id)) ?? a;
          await getSession(repo, fresh);
          results.push({ accountId: a.id, refreshed: true });
        } else {
          results.push({ accountId: a.id, refreshed: false });
        }
      } catch (e) {
        results.push({
          accountId: a.id,
          refreshed: false,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }
    res.json({ ok: true, results });
  }));

  return r;
}
