/* Token persistence QA: verifies that getSession persists encrypted tokens to
   the account doc on reauth, and that a simulated cold start (wiped memory
   cache) recovers them from the doc instead of running the Riot chain.
   run: API_JWT_SECRET=x ENCRYPTION_KEY=<64hex> VAL_FIXTURE=true npx tsx scripts/test-token-persist.ts
*/
import { createRepo } from "../src/persist/repo";
import { getSession, clearSession } from "../src/session";
import { enc } from "../src/persist/crypto";
import { FIXTURE_SSID } from "../src/fixture";

async function main(): Promise<void> {
  const repo = createRepo();
  const user = await repo.upsertUserByGoogleId("g123", { email: "t@t.com" });
  const account = await repo.upsertAccount(user.id, "puuid-1", {
    gameName: "Test",
    tagLine: "0001",
    region: "ap",
    shard: "ap",
    encryptedCookies: enc(JSON.stringify({ ssid: FIXTURE_SSID })),
  });

  // 1. first call -> fixture reauth, must persist encryptedTokens
  const t1 = await getSession(repo, account);
  const reloaded = await repo.getAccountById(account.id);
  console.log("1. encryptedTokens persisted:", !!reloaded?.encryptedTokens);

  // 2. simulate cold start: wipe the in-memory session cache
  clearSession(user.id, "puuid-1");

  // 3. second call with a fresh doc -> must use the persisted-token fallback
  const t2 = await getSession(repo, reloaded!);
  console.log("2. fallback returned identical tokens:", t2.accessToken === t1.accessToken);

  // 4. getAllAccounts (used by the refresh endpoint)
  const all = await repo.getAllAccounts();
  console.log("3. getAllAccounts count:", all.length);

  if (!reloaded?.encryptedTokens || t2.accessToken !== t1.accessToken || all.length !== 1) {
    console.error("FAIL");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
