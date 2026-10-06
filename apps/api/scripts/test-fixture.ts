/* Fixture QA: boots the real server in fixture mode (child process, so env
   is set before any module loads) and exercises
   connect / status / store / wallet / match against the contract shapes.
   No Riot network is touched: ssid "FIXTURE_SSID" short-circuits everywhere.

   run: npm run test:fixture
*/
import { spawn, type ChildProcess } from "child_process";
import { randomBytes } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { SignJWT } from "jose";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const PORT = "18099";
const API_JWT_SECRET = "fixture-test-secret-" + randomBytes(8).toString("hex");
const ENCRYPTION_KEY = randomBytes(32).toString("hex");
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
function check(name: string, cond: unknown, extra?: unknown): void {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${extra !== undefined ? " — " + JSON.stringify(extra) : ""}`);
  }
}

async function mintJwt(): Promise<string> {
  return new SignJWT({ userId: "fixture-test-user", email: "fixture@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(API_JWT_SECRET));
}

async function waitForHealth(child: ChildProcess, sawListening: () => boolean): Promise<void> {
  const deadline = Date.now() + 45000;
  for (;;) {
    // only trust /api/health once OUR child printed its listening line —
    // otherwise a stale server on the port would fake a pass
    if (sawListening()) {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) return;
      } catch {
        /* not up yet */
      }
    }
    if (Date.now() > deadline) throw new Error("server did not come up in 45s");
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function main(): Promise<void> {
  const child = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: root,
    detached: true, // own process group so we can kill the whole tree (npx -> tsx -> node)
    env: {
      ...process.env,
      PORT,
      VAL_FIXTURE: "true",
      API_JWT_SECRET,
      ENCRYPTION_KEY,
      MONGODB_URI: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => {
    const s = String(d);
    process.stdout.write(`[server] ${s}`);
    if (s.includes("[val-api] listening")) sawListeningFlag = true;
  });
  child.stderr?.on("data", (d) => process.stderr.write(`[server:err] ${d}`));
  const kill = (): void => {
    try {
      // negative pid = whole process group
      process.kill(-(child.pid as number), "SIGTERM");
    } catch {
      /* already dead */
    }
  };
  process.on("exit", kill);

  let sawListeningFlag = false;
  const sawListening = (): boolean => sawListeningFlag;

  try {
    await waitForHealth(child, sawListening);
    const jwt = await mintJwt();
    const J = { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };
    const X = { "x-ssid": "FIXTURE_SSID" };

    console.log("== health ==");
    {
      const r = await fetch(`${BASE}/api/health`);
      const j = (await r.json()) as { ok?: boolean; version?: string };
      check("GET /api/health -> {ok:true, version}", r.ok && j.ok === true && typeof j.version === "string", j);
    }

    console.log("== auth errors ==");
    {
      const r = await fetch(`${BASE}/api/status`);
      const j = (await r.json()) as { error?: string };
      check("GET /api/status without auth -> 401 {error}", r.status === 401 && typeof j.error === "string", j);
    }
    {
      const r = await fetch(`${BASE}/api/me`, { headers: { Authorization: "Bearer nope" } });
      const j = (await r.json()) as { error?: string };
      check("GET /api/me with bad jwt -> 401 {error}", r.status === 401 && typeof j.error === "string", j);
    }

    console.log("== connect ==");
    let accountId = "";
    {
      const r = await fetch(`${BASE}/api/riot/connect`, {
        method: "POST",
        headers: J,
        body: JSON.stringify({ ssid: "FIXTURE_SSID" }),
      });
      const j = (await r.json()) as { ok?: boolean; account?: { id?: string; gameName?: string; tagLine?: string; region?: string; shard?: string } };
      check("POST /api/riot/connect {ssid} -> {ok:true, account}", r.ok && j.ok === true && !!j.account?.id, j);
      check("connect account gameName/tagLine", j.account?.gameName === "FixturePlayer" && j.account?.tagLine === "FIX1", j.account);
      check("connect account region/shard", j.account?.region === "ap" && j.account?.shard === "ap", j.account);
      accountId = j.account?.id || "";
    }

    console.log("== me ==");
    {
      const r = await fetch(`${BASE}/api/me`, { headers: J });
      const j = (await r.json()) as { user?: { id?: string; email?: string }; accounts?: { id?: string; active?: boolean }[] };
      check("GET /api/me -> user + accounts", r.ok && !!j.user?.id && Array.isArray(j.accounts), j);
      check("me accounts[0] active", j.accounts?.length === 1 && j.accounts[0].active === true, j.accounts);
    }

    console.log("== status (jwt + x-ssid) ==");
    {
      const r = await fetch(`${BASE}/api/status`, { headers: J });
      const j = (await r.json()) as { connected?: boolean; gameName?: string; accountId?: string };
      check("GET /api/status (jwt) -> connected", r.ok && j.connected === true && j.gameName === "FixturePlayer" && j.accountId === accountId, j);
    }
    {
      const r = await fetch(`${BASE}/api/status`, { headers: X });
      const j = (await r.json()) as { connected?: boolean; gameName?: string };
      check("GET /api/status (x-ssid) -> connected", r.ok && j.connected === true && j.gameName === "FixturePlayer", j);
    }

    console.log("== store ==");
    {
      const r = await fetch(`${BASE}/api/store`, { headers: J });
      const j = (await r.json()) as {
        daily?: { offers?: { offerId?: string; uuid?: string; name?: string; weapon?: string; icon?: string; fallbacks?: string[]; price?: number }[]; expiresIn?: number };
        nightMarket?: { offers?: { discountPercent?: number; discountPrice?: number }[]; expiresIn?: number } | null;
        fetchedAt?: number;
      };
      const offers = j.daily?.offers || [];
      check("GET /api/store -> 4 daily offers", r.ok && offers.length === 4, offers.length);
      check(
        "daily offer shape {offerId,uuid,name,weapon,icon,fallbacks[],price}",
        offers.every((o) => o.offerId && o.uuid && o.name && o.weapon && typeof o.icon === "string" && Array.isArray(o.fallbacks) && typeof o.price === "number"),
        offers[0]
      );
      check("daily expiresIn", typeof j.daily?.expiresIn === "number", j.daily?.expiresIn);
      const nm = j.nightMarket?.offers || [];
      check("nightMarket -> 3 offers with discounts", nm.length === 3 && nm.every((o) => (o.discountPercent || 0) > 0 && typeof o.discountPrice === "number"), nm);
      check("fetchedAt", typeof j.fetchedAt === "number", j.fetchedAt);
    }

    console.log("== wallet ==");
    {
      const r = await fetch(`${BASE}/api/wallet`, { headers: J });
      const j = (await r.json()) as { vp?: number; radianite?: number };
      check("GET /api/wallet -> {vp:4750, radianite:160}", r.ok && j.vp === 4750 && j.radianite === 160, j);
    }

    console.log("== match ==");
    {
      const r = await fetch(`${BASE}/api/match`, { headers: J });
      const j = (await r.json()) as {
        inGame?: boolean; phase?: string; map?: string; mode?: string; matchId?: string;
        side?: string; sideNote?: string; myAgent?: string;
        teammates?: { name?: string; agent?: string; locked?: boolean }[];
      };
      check("GET /api/match -> inGame pregame", r.ok && j.inGame === true && j.phase === "pregame", j.phase);
      check("match side attack + sideNote", j.side === "attack" && typeof j.sideNote === "string" && j.sideNote.length > 0, { side: j.side, sideNote: j.sideNote });
      check("match myAgent", j.myAgent === "Jett", j.myAgent);
      check("match 5 teammates {name,agent}", Array.isArray(j.teammates) && j.teammates.length === 5 && j.teammates.every((t) => t.name && t.agent), j.teammates);
      check("match map/mode/matchId", j.map === "Ascent" && j.mode === "Standard" && j.matchId === "fixture-match-1", { map: j.map, mode: j.mode, matchId: j.matchId });
    }

    console.log("== switch + disconnect ==");
    {
      const r = await fetch(`${BASE}/api/riot/switch`, { method: "POST", headers: J, body: JSON.stringify({ accountId }) });
      const j = (await r.json()) as { ok?: boolean };
      check("POST /api/riot/switch -> {ok:true}", r.ok && j.ok === true, j);
    }
    {
      const r = await fetch(`${BASE}/api/riot/disconnect`, { method: "DELETE", headers: J });
      const j = (await r.json()) as { ok?: boolean };
      check("DELETE /api/riot/disconnect -> {ok:true}", r.ok && j.ok === true, j);
    }
    {
      const r = await fetch(`${BASE}/api/status`, { headers: J });
      const j = (await r.json()) as { connected?: boolean };
      check("status after disconnect -> {connected:false}", r.ok && j.connected === false, j);
    }
  } finally {
    kill();
  }

  console.log(failures === 0 ? "\nALL FIXTURE TESTS PASSED" : `\n${failures} FIXTURE TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
