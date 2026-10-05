/* valorant storefront + live match via riot client api.
   note: riot's remote api does NOT expose live round scores or
   attacking/defending sides — those only exist in the local game
   client. we show what's actually available: phase, map, mode,
   agent, teammates. */
const SHARD = process.env.VAL_SHARD || "ap";
const VP_CURRENCY = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";

let skinCache = null, skinCacheAt = 0;
let agentCache = null, agentCacheAt = 0;
let clientVersion = null;

async function getClientVersion() {
  if (clientVersion) return clientVersion;
  try {
    const j = await (await fetch("https://valorant-api.com/v1/version")).json();
    clientVersion = (j.data && j.data.riotClientVersion) || "release-11.02-shipping-12-2953356";
  } catch (e) { clientVersion = "release-11.02-shipping-12-2953356"; }
  return clientVersion;
}

async function getSkins() {
  if (skinCache && Date.now() - skinCacheAt < 24 * 3600 * 1000) return skinCache;
  const [skinsJ, weaponsJ] = await Promise.all([
    fetch("https://valorant-api.com/v1/weapons/skins").then((r) => r.json()),
    fetch("https://valorant-api.com/v1/weapons").then((r) => r.json()),
  ]);
  const weaponOf = {};
  for (const w of weaponsJ.data || []) for (const s of w.skins || []) weaponOf[s.uuid] = w.displayName;
  const map = {};
  for (const s of skinsJ.data || []) {
    const icon = s.displayIcon
      || (s.chromas && s.chromas[0] && (s.chromas[0].fullRender || s.chromas[0].displayIcon))
      || (s.levels && s.levels[0] && s.levels[0].displayIcon) || "";
    map[s.uuid] = { name: s.displayName, icon, weapon: weaponOf[s.uuid] || "" };
  }
  skinCache = map; skinCacheAt = Date.now();
  return map;
}

async function getAgents() {
  if (agentCache && Date.now() - agentCacheAt < 24 * 3600 * 1000) return agentCache;
  try {
    const j = await (await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true")).json();
    const map = {};
    for (const a of j.data || []) map[a.uuid.toLowerCase()] = a.displayName;
    agentCache = map; agentCacheAt = Date.now();
  } catch (e) { agentCache = {}; }
  return agentCache;
}

async function headers(t) {
  return {
    "Authorization": `Bearer ${t.accessToken}`,
    "X-Riot-Entitlements-JWT": t.entitlements,
    "X-Riot-ClientPlatform": "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuNzY4LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9",
    "X-Riot-ClientVersion": await getClientVersion(),
  };
}

async function getShop(t) {
  const h = await headers(t);
  const r = await fetch(`https://pd.${SHARD}.a.pvp.net/store/v3/storefront/${t.puuid}`, {
    method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: "{}",
  });
  if (r.status === 401) { const e = new Error("token expired"); e.code = "TOKEN_EXPIRED"; throw e; }
  if (!r.ok) throw new Error("storefront failed: " + r.status);
  const d = await r.json();
  const layout = d.SkinsPanelLayout || {};
  const offerIds = layout.SingleItemOffers || [];
  const expiresIn = layout.SingleItemOffersRemainingDurationInSeconds || 0;
  const prices = {};
  for (const o of layout.SingleItemStoreOffers || []) {
    prices[o.OfferID] = (o.Cost || {})[VP_CURRENCY] ?? null;
  }
  const skins = await getSkins();
  const offers = offerIds.map((id) => {
    const s = skins[id] || {};
    return { uuid: id, name: s.name || id.slice(0, 8), weapon: s.weapon || "", icon: s.icon || "", price: prices[id] };
  });
  return { offers, expiresIn, fetchedAt: Date.now() };
}

/* current match: pregame (agent select) then core-game (live) */
async function getMatch(t) {
  const h = await headers(t);
  const base = `https://glz-${SHARD}-1.${SHARD}.a.pvp.net`;
  // agent select?
  try {
    const r = await fetch(`${base}/pregame/v1/players/${t.puuid}`, { headers: h });
    if (r.ok) {
      const p = await r.json();
      const m = await (await fetch(`${base}/pregame/v1/matches/${p.MatchID}`, { headers: h })).json();
      return parsePregame(m, t.puuid);
    }
  } catch (e) { /* fall through */ }
  // live match?
  try {
    const r = await fetch(`${base}/core-game/v1/players/${t.puuid}`, { headers: h });
    if (r.ok) {
      const p = await r.json();
      const m = await (await fetch(`${base}/core-game/v1/matches/${p.MatchID}`, { headers: h })).json();
      return await parseLiveMatch(m, t.puuid);
    }
  } catch (e) { /* fall through */ }
  return { inGame: false };
}

function shortMap(mapId) {
  return String(mapId || "").split("/").pop();
}

async function parsePregame(m, puuid) {
  const agents = await getAgents();
  let me = null, mates = [];
  for (const team of m.Teams || []) {
    for (const p of team.Players || []) {
      const name = p.PlayerIdentity ? (p.PlayerIdentity.GameName || "") : "";
      const agent = agents[String(p.CharacterID || "").toLowerCase()] || "";
      if (p.Subject === puuid) me = { name, agent };
      else if (team.Players.some((x) => x.Subject === puuid)) mates.push({ name, agent });
    }
  }
  // find my team mates properly
  mates = [];
  for (const team of m.Teams || []) {
    if ((team.Players || []).some((p) => p.Subject === puuid)) {
      for (const p of team.Players) {
        if (p.Subject === puuid) continue;
        const nm = (p.PlayerIdentity && (p.PlayerIdentity.GameName || p.PlayerIdentity.AccountID)) || "?";
        mates.push({ name: nm, agent: agents[String(p.CharacterID || "").toLowerCase()] || "" });
      }
    }
  }
  return {
    inGame: true, phase: "pregame", matchId: m.ID,
    map: shortMap(m.MapID), mode: m.GameMode || "",
    myAgent: me ? me.agent : "", teammates: mates,
  };
}

async function parseLiveMatch(m, puuid) {
  const agents = await getAgents();
  let me = null;
  const mates = [], foes = [];
  let myTeamId = null;
  for (const p of m.Players || []) {
    if (p.Subject === puuid) { myTeamId = p.TeamID; break; }
  }
  for (const p of m.Players || []) {
    const nm = (p.PlayerIdentity && (p.PlayerIdentity.GameName || "")) || "?";
    const agent = agents[String(p.CharacterID || "").toLowerCase()] || "";
    if (p.Subject === puuid) me = { name: nm, agent };
    else (p.TeamID === myTeamId ? mates : foes).push({ name: nm, agent });
  }
  return {
    inGame: true, phase: "live", matchId: m.MatchID,
    map: shortMap(m.MatchInfo && m.MatchInfo.MapID),
    mode: (m.MatchInfo && (m.MatchInfo.GameMode || m.MatchInfo.QueueID)) || "",
    myAgent: me ? me.agent : "",
    teammates: mates, enemies: foes,
  };
}

module.exports = { getShop, getMatch };
