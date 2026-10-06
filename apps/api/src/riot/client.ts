import { RiotError } from "./errors";
import { riotFetch }from "./fetch";
import { RIOT_UA } from "./auth";
import type { DailyOffer, MatchData, NightOffer, RiotTokens, StoreData, Teammate, WalletData } from "../types";

export const VP_CURRENCY = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";
export const RADIANITE_CURRENCY = "e59aa87c-4cbf-517a-882a-4f4497754bf1";
export const CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuNzY4LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

/* ---------- client version (valorant-api.com) ---------- */
let clientVersion: string | null = null;
export async function getClientVersion(): Promise<string> {
  if (clientVersion) return clientVersion;
  try {
    const j = (await (await riotFetch("https://valorant-api.com/v1/version")).json()) as {
      data?: { riotClientVersion?: string };
    };
    clientVersion = (j.data && j.data.riotClientVersion) || "release-11.02-shipping-12-2953356";
  } catch {
    clientVersion = "release-11.02-shipping-12-2953356";
  }
  return clientVersion;
}

/* ---------- pd/glz headers ---------- */
export async function pdHeaders(t: RiotTokens): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${t.accessToken}`,
    "X-Riot-Entitlements-JWT": t.entitlements,
    "X-Riot-ClientPlatform": CLIENT_PLATFORM,
    "X-Riot-ClientVersion": await getClientVersion(),
    "User-Agent": RIOT_UA,
    "Content-Type": "application/json",
  };
}

/* ---------- assets: valorant-api.com, cached 24h in memory ---------- */
interface SkinInfo {
  name: string;
  weapon: string;
  icon: string;
  fullRender: string;
  levelIcon: string;
}

const DAY_MS = 24 * 3600 * 1000;
let skinCache: Record<string, SkinInfo> | null = null;
let skinCacheAt = 0;
let agentCache: Record<string, string> | null = null;
let agentCacheAt = 0;

export async function getSkinMap(): Promise<Record<string, SkinInfo>> {
  if (skinCache && Date.now() - skinCacheAt < DAY_MS) return skinCache;
  const [skinsJ, weaponsJ] = await Promise.all([
    (await riotFetch("https://valorant-api.com/v1/weapons/skins")).json() as Promise<{ data?: any[] }>,
    (await riotFetch("https://valorant-api.com/v1/weapons")).json() as Promise<{ data?: any[] }>,
  ]);
  const weaponOf: Record<string, string> = {};
  for (const w of weaponsJ.data || []) for (const s of w.skins || []) weaponOf[s.uuid] = w.displayName;
  const map: Record<string, SkinInfo> = {};
  for (const s of skinsJ.data || []) {
    const icon: string =
      s.displayIcon ||
      (s.chromas && s.chromas[0] && (s.chromas[0].fullRender || s.chromas[0].displayIcon)) ||
      (s.levels && s.levels[0] && s.levels[0].displayIcon) ||
      "";
    const fullRender: string = (s.chromas && s.chromas[0] && s.chromas[0].fullRender) || "";
    const info: SkinInfo = { name: s.displayName, weapon: weaponOf[s.uuid] || "", icon, fullRender, levelIcon: "" };
    map[s.uuid] = info;
    // storefront returns level/chroma uuids — map them back to the parent skin,
    // keeping the level-specific icon for the fallback chain
    for (const l of s.levels || []) {
      if (l.uuid) map[l.uuid] = { ...info, levelIcon: l.displayIcon || "" };
    }
    for (const c of s.chromas || []) if (c.uuid) map[c.uuid] = info;
  }
  skinCache = map;
  skinCacheAt = Date.now();
  return map;
}

export async function getAgentMap(): Promise<Record<string, string>> {
  if (agentCache && Date.now() - agentCacheAt < DAY_MS) return agentCache;
  try {
    const j = (await (
      await riotFetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true")
    ).json()) as { data?: { uuid?: string; displayName?: string }[] };
    const map: Record<string, string> = {};
    for (const a of j.data || []) if (a.uuid) map[a.uuid.toLowerCase()] = a.displayName || "";
    agentCache = map;
    agentCacheAt = Date.now();
  } catch {
    agentCache = {};
  }
  return agentCache;
}

/* skin image fallback chain: level icon -> parent icon -> fullRender */
export function skinImages(s: SkinInfo | undefined): { icon: string; fallbacks: string[] } {
  const icon = (s && (s.levelIcon || s.icon)) || "";
  const fallbacks = [s && s.icon, s && s.fullRender].filter((u): u is string => !!u && u !== icon);
  return { icon, fallbacks };
}

function offerFrom(skinId: string, skins: Record<string, SkinInfo>): { name: string; weapon: string; icon: string; fallbacks: string[] } {
  const s = skins[skinId];
  const { icon, fallbacks } = skinImages(s);
  return {
    name: (s && s.name) || String(skinId).slice(0, 8),
    weapon: (s && s.weapon) || "",
    icon,
    fallbacks,
  };
}

/* ---------- storefront ---------- */
export async function getStorefront(t: RiotTokens, shard: string): Promise<StoreData> {
  const h = await pdHeaders(t);
  const res = await riotFetch(`https://pd.${shard}.a.pvp.net/store/v3/storefront/${t.puuid}`, {
    method: "POST",
    headers: h,
    body: "{}",
  });
  if (res.status === 401) throw new RiotError("token expired", "TOKEN_EXPIRED", 401);
  if (!res.ok) throw new RiotError("storefront failed: " + res.status, "STOREFRONT_FAILED");
  const d = (await res.json()) as any;
  const layout = d.SkinsPanelLayout || {};
  const offerIds: string[] = layout.SingleItemOffers || [];
  const expiresIn = layout.SingleItemOffersRemainingDurationInSeconds || 0;
  const prices: Record<string, number | null> = {};
  const skinOf: Record<string, string> = {};
  for (const o of layout.SingleItemStoreOffers || []) {
    prices[o.OfferID] = (o.Cost && o.Cost[VP_CURRENCY]) ?? null;
    const reward = (o.Rewards || [])[0];
    if (reward && reward.ItemID) skinOf[o.OfferID] = reward.ItemID;
  }
  const skins = await getSkinMap();
  const offers: DailyOffer[] = offerIds.map((id) => {
    const skinId = skinOf[id] || id;
    return { offerId: id, uuid: skinId, ...offerFrom(skinId, skins), price: prices[id] ?? null };
  });

  let nightMarket: StoreData["nightMarket"] = null;
  const bs = d.BonusStore;
  if (bs && Array.isArray(bs.BonusStoreOffers)) {
    const nmOffers: NightOffer[] = bs.BonusStoreOffers.map((bo: any) => {
      const o = bo.Offer || {};
      const skinId = (o.Rewards && o.Rewards[0] && o.Rewards[0].ItemID) || o.OfferID || "";
      return {
        offerId: o.OfferID || "",
        uuid: skinId,
        ...offerFrom(skinId, skins),
        price: (o.Cost && o.Cost[VP_CURRENCY]) ?? null,
        discountPercent: bo.DiscountPercent ?? 0,
        discountPrice: (bo.DiscountCosts && bo.DiscountCosts[VP_CURRENCY]) ?? null,
      };
    });
    nightMarket = { offers: nmOffers, expiresIn: bs.BonusStoreRemainingDurationInSeconds || 0 };
  }
  return { daily: { offers, expiresIn }, nightMarket, fetchedAt: Date.now() };
}

/* ---------- wallet ---------- */
export async function getWallet(t: RiotTokens, shard: string): Promise<WalletData> {
  const h = await pdHeaders(t);
  const res = await riotFetch(`https://pd.${shard}.a.pvp.net/store/wallet/${t.puuid}`, { headers: h });
  if (res.status === 401) throw new RiotError("token expired", "TOKEN_EXPIRED", 401);
  if (!res.ok) throw new RiotError("wallet failed: " + res.status, "WALLET_FAILED");
  const d = (await res.json()) as { Balances?: Record<string, number> };
  const b = d.Balances || {};
  return { vp: b[VP_CURRENCY] ?? 0, radianite: b[RADIANITE_CURRENCY] ?? 0 };
}

/* ---------- name service ---------- */
export async function resolveNames(
  t: RiotTokens,
  shard: string,
  puuids: string[]
): Promise<Record<string, { gameName: string; tagLine: string }>> {
  const out: Record<string, { gameName: string; tagLine: string }> = {};
  const ids = [...new Set(puuids.filter(Boolean))];
  if (!ids.length) return out;
  try {
    const h = await pdHeaders(t);
    const res = await riotFetch(`https://pd.${shard}.a.pvp.net/name-service/v2/players`, {
      method: "PUT",
      headers: h,
      body: JSON.stringify(ids),
    });
    if (!res.ok) return out;
    const arr = (await res.json().catch(() => [])) as { Subject?: string; GameName?: string; TagLine?: string }[];
    for (const p of arr || []) {
      if (p && p.Subject) out[p.Subject] = { gameName: p.GameName || "", tagLine: p.TagLine || "" };
    }
  } catch {
    /* names are best-effort */
  }
  return out;
}

/* ---------- match ---------- */
const shortMap = (mapId: string): string => String(mapId || "").split("/").pop() || "";

const SIDE_NOTE_LIVE =
  "Side is a first-half estimate: Riot's API does not expose live attacking/defending sides. " +
  "On standard maps the Red team starts on attack and the Blue team on defense in the first half; " +
  "sides swap at halftime, so treat this as an estimate, not live truth.";

const SIDE_NOTE_PREGAME =
  "Side is unknown during agent select — Riot's API does not expose attacking/defending sides. " +
  "Once the match starts this becomes a first-half estimate (Red attacks, Blue defends).";

export async function getMatch(t: RiotTokens, shard: string, region: string): Promise<MatchData> {
  const h = await pdHeaders(t);
  const base = `https://glz-${region}-1.${shard}.a.pvp.net`;
  // agent select?
  try {
    const r = await riotFetch(`${base}/pregame/v1/players/${t.puuid}`, { headers: h });
    if (r.status === 401) throw new RiotError("token expired", "TOKEN_EXPIRED", 401);
    if (r.ok) {
      const p = (await r.json()) as { MatchID?: string };
      if (p && p.MatchID) {
        const m = await (await riotFetch(`${base}/pregame/v1/matches/${p.MatchID}`, { headers: h })).json();
        return await parsePregame(t, shard, m);
      }
    }
  } catch (e) {
    if (e instanceof RiotError) throw e;
  }
  // live match?
  try {
    const r = await riotFetch(`${base}/core-game/v1/players/${t.puuid}`, { headers: h });
    if (r.status === 401) throw new RiotError("token expired", "TOKEN_EXPIRED", 401);
    if (r.ok) {
      const p = (await r.json()) as { MatchID?: string };
      if (p && p.MatchID) {
        const m = await (await riotFetch(`${base}/core-game/v1/matches/${p.MatchID}`, { headers: h })).json();
        return await parseLive(t, shard, m);
      }
    }
  } catch (e) {
    if (e instanceof RiotError) throw e;
  }
  return { inGame: false };
}

interface RawPlayer {
  Subject?: string;
  CharacterID?: string;
  CharacterSelectionState?: string;
  TeamID?: string;
  PlayerIdentity?: { GameName?: string; TagLine?: string; AccountID?: string };
}

async function parsePregame(t: RiotTokens, shard: string, m: any): Promise<MatchData> {
  const agents = await getAgentMap();
  const teams: { Players?: RawPlayer[] }[] = m.Teams || [];
  const myTeam = teams.find((tm) => (tm.Players || []).some((p) => p.Subject === t.puuid));
  const mates: (Teammate & { puuid: string })[] = [];
  let myAgent = "";
  for (const p of (myTeam && myTeam.Players) || []) {
    const agent = agents[String(p.CharacterID || "").toLowerCase()] || "";
    if (p.Subject === t.puuid) {
      myAgent = agent;
      continue;
    }
    mates.push({
      puuid: p.Subject || "",
      name: (p.PlayerIdentity && p.PlayerIdentity.GameName) || "",
      agent,
      locked: p.CharacterSelectionState === "LOCKED",
    });
  }
  const names = await resolveNames(
    t,
    shard,
    mates.filter((x) => !x.name).map((x) => x.puuid)
  );
  const teammates: Teammate[] = mates.map((x) => ({
    name: x.name || (names[x.puuid] && names[x.puuid].gameName) || "?",
    agent: x.agent,
    locked: x.locked,
  }));
  return {
    inGame: true,
    phase: "pregame",
    map: shortMap(m.MapID),
    mode: m.GameMode || "",
    matchId: m.ID || "",
    side: "unknown",
    sideNote: SIDE_NOTE_PREGAME,
    myAgent,
    teammates,
  };
}

async function parseLive(t: RiotTokens, shard: string, m: any): Promise<MatchData> {
  const agents = await getAgentMap();
  const players: RawPlayer[] = m.Players || [];
  let myTeamId: string | null = null;
  for (const p of players) {
    if (p.Subject === t.puuid) {
      myTeamId = p.TeamID || null;
      break;
    }
  }
  const mates: (Teammate & { puuid: string })[] = [];
  const foes: ({ name: string; agent: string } & { puuid: string })[] = [];
  let myAgent = "";
  for (const p of players) {
    const agent = agents[String(p.CharacterID || "").toLowerCase()] || "";
    if (p.Subject === t.puuid) {
      myAgent = agent;
      continue;
    }
    const entry = {
      puuid: p.Subject || "",
      name: (p.PlayerIdentity && p.PlayerIdentity.GameName) || "",
      agent,
    };
    if (p.TeamID === myTeamId) mates.push(entry);
    else foes.push(entry);
  }
  const need = [...mates, ...foes].filter((x) => !x.name).map((x) => x.puuid);
  const names = await resolveNames(t, shard, need);
  const fill = (x: { puuid: string; name: string }) => x.name || (names[x.puuid] && names[x.puuid].gameName) || "?";
  // ATK/DEF heuristic: AllyTeam Red => attack, Blue => defend (first-half estimate)
  const ally = (m.AllyTeam && m.AllyTeam.TeamID) || "";
  const side: "attack" | "defend" | "unknown" = ally === "Red" ? "attack" : ally === "Blue" ? "defend" : "unknown";
  return {
    inGame: true,
    phase: "live",
    map: shortMap(m.MatchInfo && m.MatchInfo.MapID),
    mode: (m.MatchInfo && (m.MatchInfo.GameMode || m.MatchInfo.QueueID)) || "",
    matchId: m.MatchID || "",
    side,
    sideNote: SIDE_NOTE_LIVE,
    myAgent,
    teammates: mates.map((x) => ({ name: fill(x), agent: x.agent })),
    enemies: foes.map((x) => ({ name: fill(x), agent: x.agent })),
  };
}
