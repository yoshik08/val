/* valorant storefront + live match via riot client api */
const SHARD = process.env.VAL_SHARD || "ap";
const VP_CURRENCY = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";

let skinCache = null;
let skinCacheAt = 0;

async function getSkins() {
  if (skinCache && Date.now() - skinCacheAt < 24 * 3600 * 1000) return skinCache;
  const r = await fetch("https://valorant-api.com/v1/weapons/skins");
  const j = await r.json();
  const map = {};
  for (const s of j.data || []) {
    map[s.uuid] = {
      name: s.displayName,
      icon: s.displayIcon || (s.chromas && s.chromas[0] && s.chromas[0].displayIcon) || "",
      weapon: (s.displayName || "").split(" ").slice(0, -1).join(" ") || s.displayName,
    };
  }
  skinCache = map; skinCacheAt = Date.now();
  return map;
}

function headers(t) {
  return {
    "Authorization": `Bearer ${t.accessToken}`,
    "X-Riot-Entitlements-JWT": t.entitlements,
    "X-Riot-ClientPlatform": "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuNzY4LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9",
    "X-Riot-ClientVersion": "release-07.00-shipping-28-2502004",
  };
}

async function getShop(t) {
  const r = await fetch(`https://pd.${SHARD}.a.pvp.net/store/v3/storefront/${t.puuid}`, { headers: headers(t) });
  if (r.status === 401) { const e = new Error("token expired"); e.code = "TOKEN_EXPIRED"; throw e; }
  if (!r.ok) throw new Error("storefront failed: " + r.status);
  const d = await r.json();
  const layout = d.SkinsPanelLayout || {};
  const offerIds = layout.SingleItemOffers || [];
  const expiresIn = layout.SingleItemOffersRemainingDurationInSeconds || 0;
  const priceList = layout.SingleItemStoreOffers || [];
  const prices = {};
  for (const o of priceList) {
    const cost = o.Cost || {};
    prices[o.OfferID] = cost[VP_CURRENCY] ?? null;
  }
  const skins = await getSkins();
  const offers = offerIds.map((id) => {
    const s = skins[id] || {};
    return { uuid: id, name: s.name || id.slice(0, 8), weapon: s.weapon || "", icon: s.icon || "", price: prices[id] };
  });
  return { offers, expiresIn, fetchedAt: Date.now() };
}

/* current match: core-game (live) then pregame (agent select) */
async function getMatch(t) {
  const h = headers(t);
  // live match?
  try {
    const r = await fetch(`https://glz-${SHARD}-1.${SHARD}.a.pvp.net/core-game/v1/players/${t.puuid}`, { headers: h });
    if (r.ok) {
      const pre = await r.json();
      const m = await (await fetch(`https://glz-${SHARD}-1.${SHARD}.a.pvp.net/core-game/v1/matches/${pre.MatchID}`, { headers: h })).json();
      return parseLiveMatch(m, t.puuid);
    }
    if (r.status !== 404) throw new Error("core-game check failed: " + r.status);
  } catch (e) { if (e.code) throw e; /* fall through to pregame check */ }
  // agent select?
  try {
    const r = await fetch(`https://glz-${SHARD}-1.${SHARD}.a.pvp.net/pregame/v1/players/${t.puuid}`, { headers: h });
    if (r.ok) {
      const p = await r.json();
      return { inGame: true, phase: "pregame", matchId: p.MatchID };
    }
  } catch (e) { /* ignore */ }
  return { inGame: false };
}

function parseLiveMatch(m, puuid) {
  // find player's team
  let myTeam = null, me = null;
  for (const p of m.Players || []) {
    if (p.Subject === puuid) { me = p; myTeam = p.TeamID; break; }
  }
  if (!myTeam) return { inGame: true, phase: "unknown" };
  const otherTeam = myTeam === "Blue" ? "Red" : "Blue";
  const myScore = (m.AllyTeam && m.AllyTeam.RoundsWon) ?? 0;
  // figure out which ally team is mine: match team ids to Blue/Red via players
  let allyIsMine = true;
  // m.Teams: [{TeamID, RoundsPlayed, RoundsWon, ...}]
  let mine = null, theirs = null;
  for (const tm of m.Teams || []) {
    const isMine = (m.Players || []).some((p) => p.Subject === puuid && p.TeamID === tm.TeamID);
    if (isMine) mine = tm; else theirs = tm;
  }
  const roundNum = (m.MatchInfo && m.MatchInfo.RoundNumber) || 0;
  // attacking side: in valorant, TeamID "Blue" starts defending on most maps is not reliable;
  // use the current round's Ceremony/attacking info if present, else omit
  return {
    inGame: true,
    phase: "live",
    matchId: m.MatchID,
    map: (m.MatchInfo && (m.MatchInfo.MapID || "").split("/").pop()) || "",
    mode: (m.MatchInfo && m.MatchInfo.GameMode) || "",
    round: roundNum,
    scoreUs: mine ? mine.RoundsWon : 0,
    scoreThem: theirs ? theirs.RoundsWon : 0,
    agent: (me && (me.CharacterID || "").split("/").pop()) || "",
  };
}

module.exports = { getShop, getMatch };
